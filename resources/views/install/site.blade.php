@extends('install.layout', ['step' => 3])

@section('title', __('installer.site_title').' · GoJet')

@section('content')
  <h2>{{ __('installer.site_title') }}</h2>
  <p class="lead">{{ __('installer.site_text') }}</p>

  <form method="post" action="{{ route('install.run') }}" onsubmit="const button=this.querySelector('button[type=submit]');button.disabled=true;button.textContent='…'">
    @csrf

    <h3 style="margin:0 0 16px;color:#15233c;font-size:17px">{{ __('installer.site_section') }}</h3>
    <div class="grid">
      <div class="field"><label for="site_name">{{ __('installer.site_name') }}</label><input id="site_name" name="site_name" value="{{ old('site_name', 'GoJet') }}" required></div>
      <div class="field"><label for="site_url">{{ __('installer.site_url') }}</label><input id="site_url" name="site_url" type="url" value="{{ old('site_url', $suggestedUrl) }}" required></div>
      <div class="field"><label for="site_timezone">{{ __('installer.site_timezone') }}</label><select id="site_timezone" name="site_timezone" required>@foreach(['Asia/Shanghai','Asia/Hong_Kong','Asia/Singapore','Asia/Tokyo','Europe/London','Europe/Berlin','America/New_York','America/Los_Angeles','UTC'] as $timezone)<option value="{{ $timezone }}" @selected(old('site_timezone', $suggestedTimezone) === $timezone)>{{ $timezone }}</option>@endforeach</select></div>
      <div class="field"><label for="default_locale">{{ __('installer.default_language') }}</label><select id="default_locale" name="default_locale"><option value="zh_CN" @selected(old('default_locale', app()->getLocale()) === 'zh_CN')>{{ __('installer.chinese') }}</option><option value="en" @selected(old('default_locale', app()->getLocale()) === 'en')>{{ __('installer.english') }}</option></select></div>
      <div class="field full"><label for="support_email">{{ __('installer.support_email') }}</label><input id="support_email" name="support_email" type="email" value="{{ old('support_email', $suggestedSupportEmail) }}" autocomplete="email" required></div>
    </div>

    <hr style="margin:30px 0;border:0;border-top:1px solid #e5eaf2">
    <h3 style="margin:0 0 8px;color:#15233c;font-size:17px">{{ __('installer.registration_section') }}</h3>
    <p class="lead" style="margin:0 0 16px;font-size:13px">{{ __('installer.smtp_text') }}</p>
    <div style="display:grid;gap:11px;margin-bottom:18px">
      <label style="display:flex;align-items:center;gap:10px;color:#344258;font-size:14px;font-weight:700"><input style="width:18px;height:18px" type="checkbox" name="allow_registration" value="1" @checked(old('allow_registration', '1') === '1')> {{ __('installer.allow_registration') }}</label>
      <label style="display:flex;align-items:center;gap:10px;color:#344258;font-size:14px;font-weight:700"><input style="width:18px;height:18px" type="checkbox" name="require_email_verification" value="1" @checked(old('require_email_verification') === '1')> {{ __('installer.require_email_verification') }}</label>
    </div>

    <details style="border:1px solid #e1e7f0;border-radius:16px;background:#f8fafc;padding:16px" @if(old('smtp_host')) open @endif>
      <summary style="cursor:pointer;color:#263650;font-size:14px;font-weight:800">SMTP</summary>
      <div class="grid" style="margin-top:17px">
        <div class="field"><label for="smtp_host">{{ __('installer.smtp_host') }}</label><input id="smtp_host" name="smtp_host" value="{{ old('smtp_host') }}" placeholder="smtp.example.com"></div>
        <div class="field"><label for="smtp_port">{{ __('installer.smtp_port') }}</label><input id="smtp_port" name="smtp_port" type="number" min="1" max="65535" value="{{ old('smtp_port', 587) }}"></div>
        <div class="field"><label for="smtp_username">{{ __('installer.smtp_username') }}</label><input id="smtp_username" name="smtp_username" value="{{ old('smtp_username') }}" autocomplete="username"></div>
        <div class="field"><label for="smtp_password">{{ __('installer.smtp_password') }}</label><input id="smtp_password" name="smtp_password" type="password" autocomplete="new-password"></div>
        <div class="field"><label for="smtp_scheme">{{ __('installer.smtp_scheme') }}</label><select id="smtp_scheme" name="smtp_scheme"><option value="tls" @selected(old('smtp_scheme', 'tls') === 'tls')>{{ __('installer.smtp_tls') }}</option><option value="ssl" @selected(old('smtp_scheme') === 'ssl')>{{ __('installer.smtp_ssl') }}</option><option value="none" @selected(old('smtp_scheme') === 'none')>{{ __('installer.smtp_none') }}</option></select></div>
        <div class="field"><label for="mail_from_address">{{ __('installer.mail_from_address') }}</label><input id="mail_from_address" name="mail_from_address" type="email" value="{{ old('mail_from_address', $suggestedMailFrom) }}"></div>
      </div>
    </details>

    <hr style="margin:30px 0;border:0;border-top:1px solid #e5eaf2">
    <h3 style="margin:0 0 16px;color:#15233c;font-size:17px">{{ __('installer.administrator_section') }}</h3>
    <div class="grid">
      <div class="field"><label for="admin_path">{{ __('installer.admin_path') }}</label><input id="admin_path" name="admin_path" value="{{ old('admin_path', $suggestedAdminPath) }}" required autocomplete="off"><div class="help">{{ __('installer.admin_path_help') }}</div></div>
      <div class="field"><label for="admin_name">{{ __('installer.admin_name') }}</label><input id="admin_name" name="admin_name" value="{{ old('admin_name') }}" autocomplete="name" required></div>
      <div class="field full"><label for="admin_email">{{ __('installer.admin_email') }}</label><input id="admin_email" name="admin_email" type="email" value="{{ old('admin_email') }}" autocomplete="email" required></div>
      <div class="field"><label for="admin_password">{{ __('installer.admin_password') }}</label><input id="admin_password" name="admin_password" type="password" autocomplete="new-password" required><div class="help">{{ __('installer.password_help') }}</div></div>
      <div class="field"><label for="admin_password_confirmation">{{ __('installer.admin_password_confirmation') }}</label><input id="admin_password_confirmation" name="admin_password_confirmation" type="password" autocomplete="new-password" required></div>
    </div>

    <div class="notice" style="margin-top:22px">{{ __('installer.installing_notice') }}</div>

    <div class="actions">
      <a class="button secondary" href="{{ route('install.database') }}">← {{ __('installer.database') }}</a>
      <button class="button" type="submit">{{ __('installer.install_now') }}</button>
    </div>
  </form>
@endsection
