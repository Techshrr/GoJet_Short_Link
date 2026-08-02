<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="{{ csrf_token() }}">
  <title>@yield('title', __('installer.title'))</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#152033;background:#f5f7fb}*{box-sizing:border-box}body{margin:0;min-width:320px;background:radial-gradient(circle at 15% 0%,#e7f7ff 0,transparent 36rem),radial-gradient(circle at 90% 10%,#eeeaff 0,transparent 34rem),#f7f9fc;color:#142033}.shell{width:min(1080px,calc(100% - 32px));margin:0 auto}.topbar{height:74px;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:12px;color:#10213e;text-decoration:none;font-weight:800}.logo{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:linear-gradient(145deg,#5bd5e8,#7167f9);color:white;box-shadow:0 10px 30px rgba(72,112,220,.25)}.language{display:flex;gap:6px;padding:5px;border:1px solid #dce3ef;background:rgba(255,255,255,.75);border-radius:12px}.language a{padding:7px 11px;border-radius:8px;text-decoration:none;color:#63708a;font-size:13px;font-weight:700}.language a.active{background:#14213d;color:white}.hero{text-align:center;padding:36px 0 26px}.hero h1{margin:0;font-size:clamp(32px,5vw,52px);letter-spacing:-.045em;color:#0e1b34}.hero p{max-width:660px;margin:16px auto 0;color:#68758d;line-height:1.7}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:26px 0}.step{display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:14px;border:1px solid #e0e6f0;background:rgba(255,255,255,.72);color:#7a879d;font-size:13px;font-weight:700}.step b{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#edf1f7}.step.active{border-color:#9bcfe3;background:white;color:#17324a;box-shadow:0 12px 35px rgba(37,67,113,.08)}.step.active b,.step.done b{background:#172a48;color:white}.card{background:rgba(255,255,255,.92);border:1px solid #e1e7f0;border-radius:24px;box-shadow:0 26px 80px rgba(38,61,100,.12);padding:clamp(22px,4vw,42px);margin-bottom:52px}.card h2{margin:0;font-size:28px;letter-spacing:-.025em;color:#10203a}.lead{margin:10px 0 26px;color:#6e7a90;line-height:1.7}.actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:28px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 20px;border:0;border-radius:12px;background:#132644;color:white;text-decoration:none;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 10px 25px rgba(19,38,68,.18)}.button:hover{background:#1d365f}.button.secondary{background:#eef2f7;color:#33425b;box-shadow:none}.button[disabled]{opacity:.45;cursor:not-allowed}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.field.full{grid-column:1/-1}.field label{display:block;margin-bottom:7px;color:#344258;font-size:13px;font-weight:800}.field input,.field select{width:100%;height:48px;border:1px solid #d7deea;border-radius:12px;background:#fff;padding:0 14px;color:#14213b;font-size:15px;outline:none}.field input:focus,.field select:focus{border-color:#55a6c8;box-shadow:0 0 0 4px rgba(75,171,207,.12)}.help{margin-top:7px;color:#8792a6;font-size:12px;line-height:1.5}.notice{padding:14px 16px;border-radius:13px;background:#f3f7fb;color:#58677f;font-size:13px;line-height:1.6}.notice.error{background:#fff1f2;color:#a23a49;border:1px solid #fecdd3}.checks{display:grid;gap:10px}.check{display:grid;grid-template-columns:minmax(170px,1fr) 2fr auto;align-items:center;gap:16px;padding:14px 16px;border:1px solid #e5eaf2;border-radius:13px}.check-name{font-weight:800;color:#263650}.check-detail{overflow-wrap:anywhere;color:#718096;font-size:13px}.badge{padding:6px 9px;border-radius:999px;font-size:11px;font-weight:900}.badge.pass{background:#e8f8ef;color:#18794e}.badge.fail{background:#fff0f1;color:#b42338}.summary{display:grid;gap:12px;margin-top:24px}.summary-row{display:grid;grid-template-columns:150px 1fr;gap:16px;padding:15px;border-radius:13px;background:#f5f7fa}.summary-row dt{font-weight:800;color:#536078}.summary-row dd{margin:0;overflow-wrap:anywhere;color:#17243a}.footer{text-align:center;color:#8994a7;font-size:12px;padding:0 0 32px}@media(max-width:760px){.steps{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.field.full{grid-column:auto}.check{grid-template-columns:1fr auto}.check-detail{grid-column:1/-1;grid-row:2}.actions{align-items:stretch;flex-direction:column-reverse}.button{width:100%}.summary-row{grid-template-columns:1fr;gap:5px}}
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <a class="brand" href="{{ route('install.welcome') }}"><span class="logo">G</span><span>GoJet</span></a>
      <nav class="language" aria-label="{{ __('installer.language') }}">
        <a class="{{ app()->getLocale() === 'zh_CN' ? 'active' : '' }}" href="{{ route('locale.switch', 'zh_CN') }}">中文</a>
        <a class="{{ app()->getLocale() === 'en' ? 'active' : '' }}" href="{{ route('locale.switch', 'en') }}">EN</a>
      </nav>
    </header>

    <section class="hero">
      <h1>{{ __('installer.title') }}</h1>
      <p>{{ __('installer.subtitle') }}</p>
    </section>

    @php($currentStep = $step ?? 1)
    <div class="steps">
      @foreach([1 => __('installer.requirements'), 2 => __('installer.database'), 3 => __('installer.site'), 4 => __('installer.complete')] as $number => $label)
        <div class="step {{ $currentStep === $number ? 'active' : ($currentStep > $number ? 'done' : '') }}"><b>{{ $currentStep > $number ? '✓' : $number }}</b><span>{{ $label }}</span></div>
      @endforeach
    </div>

    <main class="card">
      @if($errors->any())
        <div class="notice error" style="margin-bottom:20px"><strong>{{ app()->getLocale() === 'zh_CN' ? '请检查以下问题：' : 'Please review the following:' }}</strong><ul style="margin:8px 0 0;padding-left:20px">@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div>
      @endif
      @yield('content')
    </main>

    <footer class="footer">© {{ date('Y') }} GoJet · Secure self-hosted link management</footer>
  </div>
</body>
</html>
