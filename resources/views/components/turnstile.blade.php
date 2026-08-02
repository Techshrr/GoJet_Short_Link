@props(['action'])
@if(config('gojet.auth.turnstile_enabled') && filled(config('gojet.auth.turnstile_site_key')))
  <div class="space-y-2">
    <div class="cf-turnstile" data-sitekey="{{ config('gojet.auth.turnstile_site_key') }}" data-action="{{ $action }}" data-theme="light"></div>
    @error('cf-turnstile-response')<p class="text-sm font-medium text-rose-700">{{ $message }}</p>@enderror
  </div>
  @once
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  @endonce
@endif
