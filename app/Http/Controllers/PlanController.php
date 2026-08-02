<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Subscription;
use App\Services\BillingManager;
use App\Services\QuotaService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Throwable;

class PlanController extends Controller
{
    public function pricing(): View
    {
        $plansUnavailable = false;

        try {
            $plans = Plan::where('is_public', true)
                ->where('is_active', true)
                ->orderBy('position')
                ->get();
        } catch (Throwable) {
            $plans = collect();
            $plansUnavailable = true;
        }

        return view('pages.pricing', compact('plans', 'plansUnavailable'));
    }

    public function index(Request $request, QuotaService $quotas): View
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $plans = Plan::where('is_active', true)->orderBy('position')->get();
        $currentPlan = $quotas->plan($workspace);
        $usage = $quotas->summary($workspace);
        $subscriptions = $workspace->subscriptions()
            ->with(['plan', 'coupon', 'invoices'])
            ->latest()
            ->get();
        $invoices = Invoice::where('workspace_id', $workspace->id)
            ->with(['subscription.plan'])
            ->latest()
            ->limit(30)
            ->get();

        return view('plans.index', compact(
            'workspace',
            'plans',
            'currentPlan',
            'usage',
            'subscriptions',
            'invoices',
        ));
    }

    public function request(Request $request, BillingManager $billing): RedirectResponse
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        abort_unless($workspace->owner_user_id === $request->user()->id || $request->user()->is_admin, 403);

        $data = $request->validate([
            'plan_id' => ['required', 'integer'],
            'interval' => ['required', Rule::in(['monthly', 'yearly'])],
            'coupon_code' => ['nullable', 'string', 'max:80', 'regex:/^[A-Za-z0-9_-]+$/'],
        ]);
        $plan = Plan::where('is_active', true)->findOrFail($data['plan_id']);

        if ($plan->code === 'free') {
            $workspace->subscriptions()
                ->whereIn('status', ['active', 'trialing', 'pending'])
                ->get()
                ->each(fn (Subscription $subscription) => $billing->provider($subscription->provider)->cancel($subscription));
            $workspace->update(['plan_code' => 'free']);

            return back()->with('status', __('v3.plan_changed'));
        }

        abort_unless(
            config('gojet.billing_enabled') || config('gojet.manual_billing_enabled'),
            503,
            __('v3.billing_disabled'),
        );

        $result = $billing->provider()->subscribe(
            $workspace,
            $plan,
            $data['interval'],
            $data['coupon_code'] ?? null,
        );

        $checkoutUrl = $result['checkout_url'] ?? null;
        if (is_string($checkoutUrl) && $checkoutUrl !== '') {
            return redirect()->away($checkoutUrl);
        }

        return back()->with('status', $result['subscription']->status === 'active'
            ? __('billing.plan_activated')
            : __('v3.plan_requested'));
    }

    public function cancel(
        Request $request,
        Subscription $subscription,
        BillingManager $billing,
    ): RedirectResponse {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        abort_unless(
            $subscription->workspace_id === $workspace->id
                && ($workspace->owner_user_id === $request->user()->id || $request->user()->is_admin),
            403,
        );

        $billing->provider($subscription->provider)->cancel($subscription->load(['workspace', 'plan']));

        return back()->with('status', __('v3.subscription_cancelled'));
    }

    public function approve(
        Request $request,
        Subscription $subscription,
        BillingManager $billing,
    ): RedirectResponse {
        abort_unless($request->user()->is_admin, 403);
        abort_unless($subscription->status === 'pending', 422, __('billing.subscription_not_pending'));

        $billing->provider($subscription->provider)->approve($subscription->load(['workspace', 'plan']));

        return back()->with('status', __('v3.subscription_approved'));
    }

    public function invoice(Request $request, Invoice $invoice): View
    {
        $workspace = $request->user()->currentWorkspace();
        abort_unless(
            $request->user()->is_admin
                || ($workspace && (int) $invoice->workspace_id === (int) $workspace->id),
            404,
        );

        $invoice->load(['workspace', 'subscription.plan']);

        return view('plans.invoice', compact('invoice'));
    }
}
