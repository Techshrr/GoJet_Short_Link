<?php

namespace App\Http\Controllers;

use App\Models\Coupon;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Subscription;
use App\Services\BillingManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class AdminBillingController extends Controller
{
    public function index(): View
    {
        return view('admin.billing', [
            'plans' => Plan::query()->where('is_active', true)->orderBy('position')->get(),
            'coupons' => Coupon::query()->withCount('redemptions')->latest()->paginate(20, ['*'], 'coupons_page'),
            'subscriptions' => Subscription::query()
                ->with(['workspace', 'plan', 'coupon', 'invoices'])
                ->latest()
                ->paginate(30, ['*'], 'subscriptions_page'),
            'invoices' => Invoice::query()
                ->with(['workspace', 'subscription.plan'])
                ->latest()
                ->paginate(30, ['*'], 'invoices_page'),
        ]);
    }

    public function storeCoupon(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:80', 'regex:/^[A-Za-z0-9_-]+$/', Rule::unique('coupons', 'code')],
            'name' => ['required', 'string', 'max:120'],
            'discount_type' => ['required', Rule::in(['percent', 'fixed'])],
            'discount_value' => ['required', 'numeric', 'min:0.01'],
            'plan_codes' => ['nullable', 'string', 'max:1000'],
            'max_redemptions' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
        ]);

        if ($data['discount_type'] === 'percent' && (float) $data['discount_value'] > 100) {
            return back()->withErrors(['discount_value' => __('billing.coupon_percent_limit')])->withInput();
        }

        Coupon::query()->create([
            'code' => strtoupper($data['code']),
            'name' => $data['name'],
            'discount_type' => $data['discount_type'],
            'discount_value' => $data['discount_value'],
            'plan_codes' => $this->planCodes($data['plan_codes'] ?? ''),
            'max_redemptions' => $data['max_redemptions'] ?? null,
            'starts_at' => $data['starts_at'] ?? null,
            'expires_at' => $data['expires_at'] ?? null,
            'is_active' => true,
        ]);

        return back()->with('status', __('billing.coupon_created'));
    }

    public function updateCoupon(Request $request, Coupon $coupon): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'discount_type' => ['required', Rule::in(['percent', 'fixed'])],
            'discount_value' => ['required', 'numeric', 'min:0.01'],
            'plan_codes' => ['nullable', 'string', 'max:1000'],
            'max_redemptions' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($data['discount_type'] === 'percent' && (float) $data['discount_value'] > 100) {
            return back()->withErrors(['discount_value' => __('billing.coupon_percent_limit')]);
        }

        $coupon->update([
            'name' => $data['name'],
            'discount_type' => $data['discount_type'],
            'discount_value' => $data['discount_value'],
            'plan_codes' => $this->planCodes($data['plan_codes'] ?? ''),
            'max_redemptions' => $data['max_redemptions'] ?? null,
            'starts_at' => $data['starts_at'] ?? null,
            'expires_at' => $data['expires_at'] ?? null,
            'is_active' => $request->boolean('is_active'),
        ]);

        return back()->with('status', __('billing.coupon_updated'));
    }

    public function destroyCoupon(Coupon $coupon): RedirectResponse
    {
        if ($coupon->redemptions()->exists()) {
            $coupon->update(['is_active' => false]);

            return back()->with('status', __('billing.coupon_deactivated'));
        }

        $coupon->delete();

        return back()->with('status', __('billing.coupon_deleted'));
    }

    public function markInvoicePaid(
        Invoice $invoice,
        BillingManager $billing,
    ): RedirectResponse {
        abort_unless($invoice->status === 'open', 422, __('billing.invoice_not_open'));
        $invoice->load(['subscription.workspace', 'subscription.plan']);

        if ($invoice->subscription && $invoice->subscription->status === 'pending') {
            $billing->provider($invoice->subscription->provider)->approve($invoice->subscription);
        } else {
            $invoice->update(['status' => 'paid', 'paid_at' => now()]);
        }

        return back()->with('status', __('billing.invoice_paid'));
    }

    private function planCodes(string $value): array
    {
        return collect(preg_split('/[\s,;]+/', strtolower($value)) ?: [])
            ->map(fn (string $code): string => trim($code))
            ->filter(fn (string $code): bool => preg_match('/^[a-z0-9_-]{2,60}$/', $code) === 1)
            ->unique()
            ->values()
            ->all();
    }
}
