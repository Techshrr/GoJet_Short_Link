<?php

namespace App\Http\Controllers;

use App\Models\AbuseReport;
use App\Models\BlockedTarget;
use App\Services\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminTrustController extends Controller
{
    public function resolveReport(
        Request $request,
        AbuseReport $report,
        AuditLogger $audit,
    ): RedirectResponse {
        $data = $request->validate([
            'status' => ['required', Rule::in(['resolved', 'dismissed'])],
            'resolution_notes' => ['required', 'string', 'min:3', 'max:5000'],
            'disable_link' => ['nullable', 'boolean'],
            'block_host' => ['nullable', 'boolean'],
        ]);

        DB::transaction(function () use ($request, $report, $data, $audit): void {
            $report->update([
                'status' => $data['status'],
                'resolved_by_user_id' => $request->user()->id,
                'resolution_notes' => $data['resolution_notes'],
                'resolved_at' => now(),
            ]);

            if ($request->boolean('disable_link') && $report->link) {
                $report->link->update(['status' => 'disabled']);
                $audit->record('link.disabled_from_abuse_report', $report->link, [
                    'report_id' => $report->id,
                ], $request);
            }

            if ($request->boolean('block_host') && $report->link) {
                $host = strtolower((string) parse_url($report->link->target_url, PHP_URL_HOST));

                if ($host !== '') {
                    BlockedTarget::updateOrCreate(
                        [
                            'match_type' => 'host',
                            'value_hash' => BlockedTarget::fingerprint($host),
                        ],
                        [
                            'value' => $host,
                            'reason' => 'Added from abuse report #'.$report->id,
                            'is_active' => true,
                            'created_by_user_id' => $request->user()->id,
                        ],
                    );
                }
            }

            $audit->record('abuse_report.'.$data['status'], $report, [
                'disable_link' => $request->boolean('disable_link'),
                'block_host' => $request->boolean('block_host'),
            ], $request);
        });

        return back()->with('status', __('messages.report_resolved'));
    }

    public function storeBlock(Request $request, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validate([
            'match_type' => ['required', Rule::in(['host', 'url'])],
            'value' => ['required', 'string', 'max:2048'],
            'reason' => ['nullable', 'string', 'max:5000'],
        ]);

        $value = BlockedTarget::normalize($data['match_type'], $data['value']);

        if ($data['match_type'] === 'host') {
            abort_unless(
                preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i', $value) === 1,
                422,
                __('messages.invalid_block_host'),
            );
        } else {
            abort_unless(filter_var($value, FILTER_VALIDATE_URL), 422, __('messages.invalid_block_url'));
        }

        $blocked = BlockedTarget::updateOrCreate(
            [
                'match_type' => $data['match_type'],
                'value_hash' => BlockedTarget::fingerprint($value),
            ],
            [
                'value' => $value,
                'reason' => $data['reason'] ?? null,
                'is_active' => true,
                'created_by_user_id' => $request->user()->id,
            ],
        );

        $audit->record('blocked_target.saved', $blocked, [
            'match_type' => $blocked->match_type,
            'value' => $blocked->value,
        ], $request);

        return back()->with('status', __('messages.block_created'));
    }

    public function toggleBlock(
        Request $request,
        BlockedTarget $blockedTarget,
        AuditLogger $audit,
    ): RedirectResponse {
        $blockedTarget->update(['is_active' => ! $blockedTarget->is_active]);

        $audit->record('blocked_target.toggled', $blockedTarget, [
            'is_active' => $blockedTarget->is_active,
        ], $request);

        return back()->with('status', __('messages.block_updated'));
    }
}
