<?php

namespace App\Http\Controllers;

use App\Jobs\RefreshProfileFeed;
use App\Models\ProfileFeedSource;
use App\Models\ProfilePage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProfileFeedController extends Controller
{
    public function store(Request $request, ProfilePage $profilePage): RedirectResponse
    {
        $this->authorizeProfile($request, $profilePage);
        $data = $request->validate([
            'adapter' => ['required', Rule::in(['rss', 'github', 'mastodon', 'youtube', 'json'])],
            'name' => ['required', 'string', 'max:120'],
            'source_url' => ['nullable', 'url:http,https', 'max:2048'],
            'username' => ['nullable', 'string', 'max:80'],
            'channel_id' => ['nullable', 'string', 'max:120'],
        ]);
        $this->validateAdapterInput($data);
        $source = $profilePage->feedSources()->create([
            'adapter' => $data['adapter'],
            'name' => $data['name'],
            'source_url' => $data['source_url'] ?? null,
            'configuration' => array_filter(['username' => $data['username'] ?? null, 'channel_id' => $data['channel_id'] ?? null]),
            'status' => 'pending',
            'is_active' => true,
        ]);
        RefreshProfileFeed::dispatch($source->id)->afterCommit();

        return back()->with('status', 'Feed source created and queued for refresh.');
    }

    public function update(Request $request, ProfilePage $profilePage, ProfileFeedSource $source): RedirectResponse
    {
        $this->authorizeSource($request, $profilePage, $source);
        $data = $request->validate([
            'adapter' => ['required', Rule::in(['rss', 'github', 'mastodon', 'youtube', 'json'])],
            'name' => ['required', 'string', 'max:120'],
            'source_url' => ['nullable', 'url:http,https', 'max:2048'],
            'username' => ['nullable', 'string', 'max:80'],
            'channel_id' => ['nullable', 'string', 'max:120'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $this->validateAdapterInput($data);
        $source->update([
            'adapter' => $data['adapter'],
            'name' => $data['name'],
            'source_url' => $data['source_url'] ?? null,
            'configuration' => array_filter(['username' => $data['username'] ?? null, 'channel_id' => $data['channel_id'] ?? null]),
            'is_active' => $request->boolean('is_active'),
            'status' => 'pending',
        ]);
        RefreshProfileFeed::dispatch($source->id)->afterCommit();

        return back()->with('status', 'Feed source updated.');
    }

    public function refresh(Request $request, ProfilePage $profilePage, ProfileFeedSource $source): RedirectResponse
    {
        $this->authorizeSource($request, $profilePage, $source);
        RefreshProfileFeed::dispatch($source->id);

        return back()->with('status', 'Feed refresh queued.');
    }

    public function destroy(Request $request, ProfilePage $profilePage, ProfileFeedSource $source): RedirectResponse
    {
        $this->authorizeSource($request, $profilePage, $source);
        $source->delete();

        return back()->with('status', 'Feed source deleted.');
    }

    private function validateAdapterInput(array $data): void
    {
        if (in_array($data['adapter'], ['rss', 'mastodon', 'json'], true)) {
            abort_unless(filled($data['source_url'] ?? null), 422, 'A source URL is required for this adapter.');
        }
        if ($data['adapter'] === 'github') {
            abort_unless(filled($data['username'] ?? null), 422, 'A GitHub username is required.');
        }
        if ($data['adapter'] === 'youtube') {
            abort_unless(filled($data['channel_id'] ?? null), 422, 'A YouTube channel ID is required.');
        }
    }

    private function authorizeProfile(Request $request, ProfilePage $profile): void
    {
        abort_unless($request->user()->is_admin || $request->user()->currentWorkspace()?->id === $profile->workspace_id, 403);
    }

    private function authorizeSource(Request $request, ProfilePage $profile, ProfileFeedSource $source): void
    {
        $this->authorizeProfile($request, $profile);
        abort_unless($source->profile_page_id === $profile->id, 404);
    }
}
