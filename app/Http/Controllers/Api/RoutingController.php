<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Link;
use App\Models\LinkDestination;
use App\Models\RoutingRule;
use App\Services\UrlSafetyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class RoutingController extends Controller
{
    public function index(Request $request, Link $link): JsonResponse
    {
        $this->authorize($request, $link);

        return response()->json(['data' => $link->load(['destinations.rules'])]);
    }

    public function storeDestination(Request $request, Link $link, UrlSafetyService $safety): JsonResponse
    {
        $this->authorize($request, $link);
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'target_url' => ['required', 'string', 'max:4096'],
            'weight' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'is_fallback' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        try {
            $data['target_url'] = $safety->normalizeAndValidate($data['target_url']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        if ($data['is_fallback'] ?? false) {
            $link->destinations()->update(['is_fallback' => false]);
        }
        $destination = $link->destinations()->create(array_merge($data, ['weight' => $data['weight'] ?? 100, 'position' => ((int) $link->destinations()->max('position')) + 10, 'is_active' => $data['is_active'] ?? true]));
        $link->forgetRedirectCache();

        return response()->json(['data' => $destination], 201);
    }

    public function updateDestination(Request $request, Link $link, LinkDestination $destination, UrlSafetyService $safety): JsonResponse
    {
        $this->authorizeDestination($request, $link, $destination);
        $data = $request->validate([
            'name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'target_url' => ['sometimes', 'required', 'string', 'max:4096'],
            'weight' => ['sometimes', 'integer', 'min:0', 'max:10000'],
            'position' => ['sometimes', 'integer', 'min:0'],
            'is_fallback' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (isset($data['target_url'])) {
            try {
                $data['target_url'] = $safety->normalizeAndValidate($data['target_url']);
            } catch (InvalidArgumentException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }
        if ($data['is_fallback'] ?? false) {
            $link->destinations()->whereKeyNot($destination->id)->update(['is_fallback' => false]);
        }
        $destination->update($data);
        $link->forgetRedirectCache();

        return response()->json(['data' => $destination->fresh()]);
    }

    public function destroyDestination(Request $request, Link $link, LinkDestination $destination): JsonResponse
    {
        $this->authorizeDestination($request, $link, $destination);
        $destination->delete();
        $link->forgetRedirectCache();

        return response()->json(status: 204);
    }

    public function storeRule(Request $request, Link $link): JsonResponse
    {
        $this->authorize($request, $link);
        $data = $request->validate([
            'destination_id' => ['required', 'integer'],
            'type' => ['required', Rule::in(['country', 'region', 'city', 'device', 'platform', 'browser', 'language', 'referrer', 'query', 'schedule'])],
            'operator' => ['required', Rule::in(['in', 'not_in', 'equals', 'contains', 'exists', 'missing'])],
            'values' => ['required', 'array'],
            'priority' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $destination = $link->destinations()->findOrFail($data['destination_id']);
        $rule = $link->routingRules()->create(array_merge($data, ['destination_id' => $destination->id, 'priority' => $data['priority'] ?? 100, 'is_active' => $data['is_active'] ?? true]));
        $link->forgetRedirectCache();

        return response()->json(['data' => $rule], 201);
    }

    public function updateRule(Request $request, Link $link, RoutingRule $rule): JsonResponse
    {
        $this->authorizeRule($request, $link, $rule);
        $data = $request->validate([
            'destination_id' => ['sometimes', 'integer'],
            'type' => ['sometimes', Rule::in(['country', 'region', 'city', 'device', 'platform', 'browser', 'language', 'referrer', 'query', 'schedule'])],
            'operator' => ['sometimes', Rule::in(['in', 'not_in', 'equals', 'contains', 'exists', 'missing'])],
            'values' => ['sometimes', 'array'],
            'priority' => ['sometimes', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (isset($data['destination_id'])) {
            $link->destinations()->findOrFail($data['destination_id']);
        }
        $rule->update($data);
        $link->forgetRedirectCache();

        return response()->json(['data' => $rule->fresh()]);
    }

    public function destroyRule(Request $request, Link $link, RoutingRule $rule): JsonResponse
    {
        $this->authorizeRule($request, $link, $rule);
        $rule->delete();
        $link->forgetRedirectCache();

        return response()->json(status: 204);
    }

    private function authorize(Request $request, Link $link): void
    {
        abort_unless($link->workspace_id === $request->attributes->get('workspace')?->id, 404);
    }

    private function authorizeDestination(Request $request, Link $link, LinkDestination $destination): void
    {
        $this->authorize($request, $link);
        abort_unless($destination->link_id === $link->id, 404);
    }

    private function authorizeRule(Request $request, Link $link, RoutingRule $rule): void
    {
        $this->authorize($request, $link);
        abort_unless($rule->link_id === $link->id, 404);
    }
}
