@extends('install.layout', ['step' => 1])

@section('title', __('installer.requirements_title').' · GoJet')

@section('content')
  <h2>{{ __('installer.requirements_title') }}</h2>
  <p class="lead">{{ __('installer.requirements_text') }}</p>

  <div class="checks">
    @foreach($checks as $check)
      <div class="check">
        <div class="check-name">{{ $check['name'] }}</div>
        <div class="check-detail">{{ $check['detail'] }}</div>
        <span class="badge {{ $check['passed'] ? 'pass' : 'fail' }}">{{ $check['passed'] ? __('installer.passed') : __('installer.failed') }}</span>
      </div>
    @endforeach
  </div>

  <div class="actions">
    <a class="button secondary" href="{{ route('install.requirements') }}">{{ __('installer.recheck') }}</a>
    @if($ready)
      <a class="button" href="{{ route('install.database') }}">{{ __('installer.continue') }} →</a>
    @else
      <button class="button" disabled>{{ __('installer.fix_before_continue') }}</button>
    @endif
  </div>
@endsection
