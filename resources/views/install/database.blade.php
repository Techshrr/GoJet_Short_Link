@extends('install.layout', ['step' => 2])

@section('title', __('installer.database_title').' · GoJet')

@section('content')
  <h2>{{ __('installer.database_title') }}</h2>
  <p class="lead">{{ __('installer.database_text') }}</p>

  <form method="post" action="{{ route('install.database.store') }}">
    @csrf
    <div class="grid">
      <div class="field"><label for="host">{{ __('installer.db_host') }}</label><input id="host" name="host" value="{{ old('host', $database['host']) }}" required></div>
      <div class="field"><label for="port">{{ __('installer.db_port') }}</label><input id="port" name="port" type="number" value="{{ old('port', $database['port']) }}" required></div>
      <div class="field"><label for="name">{{ __('installer.db_name') }}</label><input id="name" name="name" value="{{ old('name', $database['name']) }}" required></div>
      <div class="field"><label for="username">{{ __('installer.db_username') }}</label><input id="username" name="username" value="{{ old('username', $database['username']) }}" required></div>
      <div class="field full"><label for="password">{{ __('installer.db_password') }}</label><input id="password" name="password" type="password" autocomplete="new-password"><div class="help">{{ __('installer.optional') }}</div></div>
      <div class="field"><label for="redis_host">{{ __('installer.redis_host') }}</label><input id="redis_host" name="redis_host" value="{{ old('redis_host', $database['redis_host']) }}" required></div>
      <div class="field"><label for="redis_port">{{ __('installer.redis_port') }}</label><input id="redis_port" name="redis_port" type="number" value="{{ old('redis_port', $database['redis_port']) }}" required></div>
      <div class="field full"><label for="redis_password">{{ __('installer.redis_password') }}</label><input id="redis_password" name="redis_password" type="password" autocomplete="new-password"><div class="help">{{ __('installer.optional') }}</div></div>
    </div>

    <div class="actions">
      <a class="button secondary" href="{{ route('install.requirements') }}">← {{ __('installer.requirements') }}</a>
      <button class="button" type="submit">{{ __('installer.test_and_continue') }} →</button>
    </div>
  </form>
@endsection
