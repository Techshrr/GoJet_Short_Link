<!doctype html>
<html lang="{{ str_replace('_','-',app()->getLocale()) }}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="{{ $profile->bio }}"><title>{{ $profile->title }} · {{ config('app.name') }}</title>@vite(['resources/css/app.css','resources/js/app.js'])</head>
<body class="min-h-screen antialiased" style="background:{{ data_get($profile->theme_settings,'background','#f8fafc') }};color:{{ data_get($profile->theme_settings,'foreground','#0f172a') }}">
  <main class="mx-auto max-w-xl px-5 py-12 text-center sm:py-16">
    @if($profile->avatar_path)<img class="mx-auto h-28 w-28 rounded-full object-cover shadow-xl ring-4 ring-white/60" src="{{ Storage::url($profile->avatar_path) }}" alt="{{ $profile->title }}">@else<div class="mx-auto grid h-28 w-28 place-items-center rounded-full bg-white/70 text-4xl font-black shadow-xl ring-4 ring-white/40">{{ Str::upper(Str::substr($profile->title,0,1)) }}</div>@endif
    <h1 class="mt-6 text-3xl font-black tracking-tight">{{ $profile->title }}</h1><p class="mx-auto mt-3 max-w-lg whitespace-pre-wrap text-sm leading-7 opacity-75">{{ $profile->bio }}</p>
    <div class="mt-8 space-y-4">
      @foreach($visibleBlocks as $block)
        @if($block->type==='heading')
          <h2 class="pt-5 text-xl font-black">{{ data_get($block->content,'label') }}</h2>
        @elseif($block->type==='text')
          <div class="whitespace-pre-wrap text-sm leading-7 opacity-80">{{ data_get($block->content,'text') }}</div>
        @elseif($block->type==='image' && data_get($block->content,'image_url'))
          <img class="w-full rounded-3xl shadow-lg" src="{{ data_get($block->content,'image_url') }}" alt="{{ data_get($block->content,'label') }}" loading="lazy">
        @elseif(in_array($block->type,['link','social','video','embed']) && data_get($block->content,'url'))
          <a class="block w-full px-5 py-4 font-bold shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl" style="background:{{ data_get($profile->theme_settings,'accent','#06b6d4') }};color:white;border-radius:{{ data_get($profile->theme_settings,'button_style')==='pill'?'9999px':(data_get($profile->theme_settings,'button_style')==='square'?'0':'1rem') }}" href="{{ route('profiles.block.click',[$profile,$block]) }}" rel="nofollow noopener noreferrer">{{ data_get($block->content,'label') ?: data_get($block->content,'url') }}</a>
        @elseif($block->type==='contact')
          <div class="rounded-3xl bg-white/50 p-5 text-sm shadow-sm backdrop-blur"><p class="font-bold">{{ data_get($block->content,'label') }}</p><div class="mt-2 flex flex-wrap justify-center gap-3">@if(data_get($block->content,'email'))<a class="underline" href="mailto:{{ data_get($block->content,'email') }}">{{ data_get($block->content,'email') }}</a>@endif @if(data_get($block->content,'phone'))<a class="underline" href="tel:{{ data_get($block->content,'phone') }}">{{ data_get($block->content,'phone') }}</a>@endif</div></div>
        @endif
      @endforeach
    </div>
    <a class="mt-12 inline-flex items-center gap-2 text-xs font-bold opacity-50 transition hover:opacity-100" href="{{ route('home') }}"><span class="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 text-white">G</span>{{ config('app.name') }}</a>
  </main>
</body>
</html>
