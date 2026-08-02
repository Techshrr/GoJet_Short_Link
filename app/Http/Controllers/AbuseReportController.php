<?php

namespace App\Http\Controllers;

use App\Models\AbuseReport;
use App\Models\Link;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AbuseReportController extends Controller
{
    public function create(Request $request): View
    {
        return view('report', ['slug' => $request->query('slug')]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'short_url' => ['required', 'url:http,https', 'max:2048'],
            'reporter_email' => ['required', 'email', 'max:190'],
            'reason' => ['required', 'in:phishing,malware,spam,impersonation,illegal,other'],
            'details' => ['required', 'string', 'min:20', 'max:5000'],
        ]);

        $parts = parse_url($data['short_url']);
        $host = strtolower((string) ($parts['host'] ?? ''));
        $slug = trim((string) ($parts['path'] ?? ''), '/');
        $link = Link::query()->where('host', $host)->where('slug', $slug)->first();

        AbuseReport::create($data + ['link_id' => $link?->id, 'status' => 'open']);

        return redirect()->route('report.create')->with('status', __('messages.report_received'));
    }
}
