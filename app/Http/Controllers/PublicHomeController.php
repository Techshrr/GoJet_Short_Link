<?php

namespace App\Http\Controllers;

use App\Models\Domain;
use App\Models\ProfilePage;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PublicHomeController extends Controller
{
    public function __invoke(Request $request): View
    {
        $host = strtolower($request->getHost());
        if ($host !== strtolower((string) config('gojet.default_host'))) {
            $domain = Domain::where('hostname', $host)->where('status', 'active')->first();
            if ($domain) {
                $profile = ProfilePage::where('domain_id', $domain->id)->where('status', 'published')->with(['blocks', 'feedSources'])->first();
                if ($profile) {
                    $profile->increment('views_count');

                    return view('profiles.show', ['profile' => $profile, 'visibleBlocks' => $profile->blocks->filter->isVisible()]);
                }
            }
        }

        return view('home');
    }
}
