@php($zh=app()->getLocale()==='zh_CN')
<x-layouts.marketing :title="__('v3.public.status_title')">
  <section class="mx-auto max-w-5xl px-5 py-20 lg:px-8">
    <div class="text-center">
      <span class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold {{ $overall?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-800' }}"><span class="h-2 w-2 rounded-full {{ $overall?'bg-emerald-500':'bg-amber-500' }}"></span>{{ $overall?($zh?'所有已检测组件正常':'All checked components operational'):($zh?'部分组件需要检查':'Some components need attention') }}</span>
      <h1 class="mt-5 text-4xl font-black text-slate-950 sm:text-6xl">{{ __('v3.public.status_title') }}</h1>
      <p class="mx-auto mt-5 max-w-2xl text-slate-600">{{ $zh?'状态来自当前实例的实时轻量探测，不使用固定“正常”文案伪装可用性。详细错误只在管理后台诊断页显示。':'Status comes from lightweight live probes on this instance rather than a fixed operational claim. Detailed errors remain available only to administrators.' }}</p>
      <p class="mt-3 text-xs text-slate-400">{{ $zh?'检测时间':'Checked at' }}：{{ $checkedAt->format('Y-m-d H:i:s T') }}</p>
    </div>
    <div class="mt-12 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      @foreach($components as $component)
        <div class="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
          <div><strong class="font-bold text-slate-800">{{ $component['name'] }}</strong><p class="mt-1 text-sm text-slate-500">{{ $component['detail'] }}</p></div>
          <span class="{{ $component['ok']?'badge-success':'badge-neutral' }}">{{ $component['ok']?($zh?'正常':'Operational'):($zh?'需要检查':'Needs attention') }}</span>
        </div>
      @endforeach
    </div>
    <div class="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">{{ $zh?'该页面不会公开数据库、SMTP 或内部服务错误详情。管理员应在独立管理后台的“服务与诊断”中查看失败原因、统计写入失败、邮件日志和队列状态。':'This page does not expose database, SMTP, or internal service errors. Administrators can inspect failure details, analytics ingestion failures, mail logs, and queue state in the separate administration diagnostics area.' }}</div>
  </section>
</x-layouts.marketing>
