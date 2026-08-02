@extends('install.layout', ['step' => 4])

@section('title', __('installer.complete_title').' · GoJet')

@section('content')
  <div style="display:grid;place-items:center;width:58px;height:58px;margin:0 auto 18px;border-radius:18px;background:#e8f8ef;color:#18794e;font-size:28px;font-weight:900">✓</div>
  <h2 style="text-align:center">{{ __('installer.complete_title') }}</h2>
  <p class="lead" style="text-align:center">{{ __('installer.complete_text') }}</p>

  <dl class="summary">
    <div class="summary-row"><dt>{{ __('installer.website') }}</dt><dd><a href="{{ $details['site_url'] }}">{{ $details['site_url'] }}</a></dd></div>
    <div class="summary-row"><dt>{{ __('installer.admin_url') }}</dt><dd><a href="{{ $details['admin_url'] }}">{{ $details['admin_url'] }}</a></dd></div>
    <div class="summary-row"><dt>{{ __('installer.admin_account') }}</dt><dd>{{ $details['admin_name'] }} · {{ $details['admin_email'] }}</dd></div>
    <div class="summary-row"><dt>{{ __('installer.support_contact') }}</dt><dd>{{ $details['support_email'] }}</dd></div>
    <div class="summary-row"><dt>{{ __('installer.registration_status') }}</dt><dd>{{ $details['registration'] ? __('installer.enabled') : __('installer.disabled') }}</dd></div>
    <div class="summary-row"><dt>{{ __('installer.verification_status') }}</dt><dd>{{ $details['verification'] ? __('installer.enabled') : __('installer.disabled') }}</dd></div>
  </dl>

  <div class="notice" style="margin-top:22px"><strong>{{ __('installer.password_hidden') }}</strong><br>{{ __('installer.security_notice') }}</div>

  <div class="actions">
    <a class="button secondary" href="{{ $details['site_url'] }}">{{ __('installer.open_site') }}</a>
    <a class="button" href="{{ $details['admin_url'] }}">{{ __('installer.open_admin') }} →</a>
  </div>
@endsection
