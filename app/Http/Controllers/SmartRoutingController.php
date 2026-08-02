<?php

namespace App\Http\Controllers;

use App\Models\Link;
use App\Models\LinkDestination;
use App\Models\RoutingRule;
use App\Services\SmartRoutingService;
use App\Services\UrlSafetyService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use InvalidArgumentException;

class SmartRoutingController extends Controller
{
    public function show(Request $request, Link $link): View
    {
        $this->authorizeLink($request, $link);
        $link->load(['destinations.rules']);

        return view('links.routing', compact('link'));
    }

    public function storeDestination(Request $request, Link $link, UrlSafetyService $safety): RedirectResponse
    {
        $this->authorizeLink($request, $link);
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'target_url' => ['required', 'string', 'max:4096'],
            'weight' => ['required', 'integer', 'min:0', 'max:10000'],
            'is_fallback' => ['nullable', 'boolean'],
        ]);
        try {
            $data['target_url'] = $safety->normalizeAndValidate($data['target_url']);
        } catch (InvalidArgumentException $exception) {
            return back()->withErrors(['target_url' => $exception->getMessage()])->withInput();
        }
        if ($request->boolean('is_fallback')) {
            $link->destinations()->update(['is_fallback' => false]);
        }
        $data['is_fallback'] = $request->boolean('is_fallback');
        $data['position'] = ((int) $link->destinations()->max('position')) + 10;
        $link->destinations()->create($data);
        $link->forgetRedirectCache();

        return back()->with('status', __('v3.destination_created'));
    }

    public function updateDestination(Request $request, Link $link, LinkDestination $destination, UrlSafetyService $safety): RedirectResponse
    {
        $this->authorizeDestination($request, $link, $destination);
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'target_url' => ['required', 'string', 'max:4096'],
            'weight' => ['required', 'integer', 'min:0', 'max:10000'],
            'position' => ['nullable', 'integer', 'min:0'],
            'is_fallback' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        try {
            $data['target_url'] = $safety->normalizeAndValidate($data['target_url']);
        } catch (InvalidArgumentException $exception) {
            return back()->withErrors(['target_url' => $exception->getMessage()])->withInput();
        }
        if ($request->boolean('is_fallback')) {
            $link->destinations()->whereKeyNot($destination->id)->update(['is_fallback' => false]);
        }
        $data['is_fallback'] = $request->boolean('is_fallback');
        $data['is_active'] = $request->boolean('is_active');
        $destination->update($data);
        $link->forgetRedirectCache();

        return back()->with('status', __('v3.destination_updated'));
    }

    public function destroyDestination(Request $request, Link $link, LinkDestination $destination): RedirectResponse
    {
        $this->authorizeDestination($request, $link, $destination);
        $destination->delete();
        $link->forgetRedirectCache();

        return back()->with('status', __('v3.destination_deleted'));
    }

    public function storeRule(Request $request, Link $link): RedirectResponse
    {
        $this->authorizeLink($request, $link);
        $data = $request->validate([
            'destination_id' => ['required', 'integer'],
            'type' => ['required', Rule::in(['country', 'region', 'city', 'device', 'platform', 'browser', 'language', 'referrer', 'query', 'schedule'])],
            'operator' => ['required', Rule::in(['in', 'not_in', 'equals', 'contains', 'exists', 'missing'])],
            'values' => ['required', 'string', 'max:10000'],
            'priority' => ['required', 'integer', 'min:1', 'max:100000'],
        ]);
        $destination = $link->destinations()->findOrFail($data['destination_id']);
        $link->routingRules()->create([
            'destination_id' => $destination->id,
            'type' => $data['type'],
            'operator' => $data['operator'],
            'values' => $this->parseValues($data['type'], $data['values']),
            'priority' => $data['priority'],
            'is_active' => true,
        ]);
        $link->forgetRedirectCache();

        return back()->with('status', __('v3.rule_created'));
    }

    public function updateRule(Request $request, Link $link, RoutingRule $rule): RedirectResponse
    {
        $this->authorizeRule($request, $link, $rule);
        $data = $request->validate([
            'destination_id' => ['required', 'integer'],
            'type' => ['required', Rule::in(['country', 'region', 'city', 'device', 'platform', 'browser', 'language', 'referrer', 'query', 'schedule'])],
            'operator' => ['required', Rule::in(['in', 'not_in', 'equals', 'contains', 'exists', 'missing'])],
            'values' => ['required', 'string', 'max:10000'],
            'priority' => ['required', 'integer', 'min:1', 'max:100000'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $destination = $link->destinations()->findOrFail($data['destination_id']);
        $rule->update([
            'destination_id' => $destination->id,
            'type' => $data['type'],
            'operator' => $data['operator'],
            'values' => $this->parseValues($data['type'], $data['values']),
            'priority' => $data['priority'],
            'is_active' => $request->boolean('is_active'),
        ]);
        $link->forgetRedirectCache();

        return back()->with('status', __('v3.rule_updated'));
    }

    public function destroyRule(Request $request, Link $link, RoutingRule $rule): RedirectResponse
    {
        $this->authorizeRule($request, $link, $rule);
        $rule->delete();
        $link->forgetRedirectCache();

        return back()->with('status', __('v3.rule_deleted'));
    }

    public function simulate(Request $request, Link $link, SmartRoutingService $routing): RedirectResponse
    {
        $this->authorizeLink($request, $link);
        $data = $request->validate([
            'country' => ['nullable', 'string', 'max:2'],
            'region' => ['nullable', 'string', 'max:120'],
            'city' => ['nullable', 'string', 'max:120'],
            'device' => ['nullable', 'string', 'max:30'],
            'platform' => ['nullable', 'string', 'max:40'],
            'browser' => ['nullable', 'string', 'max:40'],
            'language' => ['nullable', 'string', 'max:20'],
            'referrer' => ['nullable', 'string', 'max:253'],
            'query_key' => ['nullable', 'string', 'max:100'],
            'query_value' => ['nullable', 'string', 'max:500'],
        ]);
        $context = array_merge([
            'country' => '', 'region' => '', 'city' => '', 'device' => '', 'platform' => '',
            'browser' => '', 'language' => '', 'referrer' => '', 'query' => [], 'now' => now(),
        ], Arr::except($data, ['query_key', 'query_value']));
        if (filled($data['query_key'] ?? null)) {
            $context['query'][$data['query_key']] = $data['query_value'] ?? '';
        }
        $link->load(['routingRules.destination', 'destinations']);
        $matched = $link->routingRules->where('is_active', true)->sortBy('priority')->first(fn ($rule) => $rule->destination?->is_active && $routing->matches($rule, $context));
        $destination = $matched?->destination ?? $link->destinations->firstWhere('is_fallback', true) ?? $link->destinations->first();

        return back()->with('routing_simulation', $destination ? ['name' => $destination->name ?: '#'.$destination->id, 'url' => $destination->target_url, 'rule' => $matched?->id] : null);
    }

    private function parseValues(string $type, string $input): array
    {
        $decoded = json_decode($input, true);
        if (is_array($decoded)) {
            return $decoded;
        }
        if (in_array($type, ['query', 'schedule'], true)) {
            abort(422, __('v3.rule_json_required'));
        }

        return collect(preg_split('/[\r\n,]+/', $input) ?: [])->map(fn ($value) => trim((string) $value))->filter()->values()->all();
    }

    private function authorizeLink(Request $request, Link $link): void
    {
        abort_unless($request->user()->is_admin || $request->user()->currentWorkspace()?->id === $link->workspace_id, 403);
    }

    private function authorizeDestination(Request $request, Link $link, LinkDestination $destination): void
    {
        $this->authorizeLink($request, $link);
        abort_unless($destination->link_id === $link->id, 404);
    }

    private function authorizeRule(Request $request, Link $link, RoutingRule $rule): void
    {
        $this->authorizeLink($request, $link);
        abort_unless($rule->link_id === $link->id, 404);
    }
}
