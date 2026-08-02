@extends('install.layout', ['step' => 1])

@section('title', __('installer.welcome_title').' · GoJet')

@section('content')
  <h2>{{ __('installer.welcome_title') }}</h2>
  <p class="lead">{{ __('installer.welcome_text') }}</p>

  <div class="notice">
    <strong>{{ app()->getLocale() === 'zh_CN' ? '安装前准备' : 'Before you begin' }}</strong><br>
    {{ app()->getLocale() === 'zh_CN'
      ? '请先在面板中创建一个空的 MySQL 数据库并确认 Redis 服务已启动。网站运行目录必须设置为项目的 public 目录。'
      : 'Create an empty MySQL database, make sure Redis is running, and point the website document root to the project public directory.' }}
  </div>

  <div class="actions">
    <span></span>
    <a class="button" href="{{ route('install.requirements') }}">{{ __('installer.start') }} →</a>
  </div>
@endsection
