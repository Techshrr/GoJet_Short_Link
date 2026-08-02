@props([
  'kicker',
  'title',
  'description',
  'features' => [],
  'workflow' => [],
  'audiences' => [],
  'faq' => [],
])
@php
  $workflow = count($workflow) ? $workflow : [
    ['title'=>'创建并配置','description'=>'从一个清晰的创建流程开始，所有高级选项按需展开。'],
    ['title'=>'发布到任意渠道','description'=>'使用品牌短链、二维码、API 或批量导入把内容分发出去。'],
    ['title'=>'分析并持续优化','description'=>'用真实访问数据、来源和转化结果更新下一次决策。'],
  ];
  $audiences = count($audiences) ? $audiences : [
    ['title'=>'营销团队','description'=>'统一管理渠道链接、UTM、二维码、活动和转化归因。'],
    ['title'=>'创作者','description'=>'使用自己的域名沉淀长期内容入口和受众数据。'],
    ['title'=>'产品与开发团队','description'=>'通过 API、Webhook 和工作区把链接能力接入现有流程。'],
    ['title'=>'企业组织','description'=>'利用成员角色、审计、配额和安全策略治理品牌资产。'],
  ];
  $faq = count($faq) ? $faq : [
    ['q'=>'创建后还能修改目标地址吗？','a'=>'可以。短地址保持不变，目标地址、规则、UTM、有效期和访问控制都可以继续调整。'],
    ['q'=>'访问统计是实时的吗？','a'=>'Laravel 跳转路径会同步写入核心统计；启用 Go Redirect Plane 后，访问事件先写入持久化磁盘队列，再同步投递到控制面；故障恢复后会自动重试。'],
    ['q'=>'可以使用自己的域名吗？','a'=>'可以。验证 DNS 后即可创建品牌短链，并跟踪证书、域名状态和异常。'],
    ['q'=>'数据可以导出吗？','a'=>'链接明细和访问事件可导出 CSV，API 也可以用于接入内部分析系统。'],
  ];
@endphp
<x-layouts.marketing :title="$title" :description="$description">
  <section class="product-hero">
    <div class="product-hero-copy">
      <span class="badge-mint">{{ $kicker }}</span>
      <h1>{{ $title }}</h1>
      <p>{{ $description }}</p>
      <div class="product-hero-actions"><a href="{{ auth()->check()?route('links.index'):route('register') }}" class="btn-primary">立即开始 →</a><a href="#capabilities" class="btn-secondary">查看能力</a></div>
      <div class="hero-proof"><span>无需信用卡</span><span>可自托管</span><span>数据可导出</span></div>
    </div>
    <div class="product-hero-visual">
      <div class="browser-frame">
        <div class="browser-top"><span></span><span></span><span></span><div>app.gojet.cc</div></div>
        <div class="browser-body">
          <aside><b>G</b><i></i><i></i><i></i><i></i><i></i></aside>
          <div class="browser-content">
            <div class="mock-head"><div><small>产品界面示意 · {{ $kicker }}</small><strong>{{ $title }}</strong></div><button>创建</button></div>
            <div class="mock-stats"><div><small>总访问</small><strong>—</strong><em>真实数据</em></div><div><small>独立访客</small><strong>—</strong><em>真实数据</em></div><div><small>转化</small><strong>—</strong><em>真实数据</em></div></div>
            <div class="mock-chart">@foreach([38,51,44,64,58,76,69,86,72,94,84,100] as $h)<i style="height:{{ $h }}%"></i>@endforeach</div>
            <div class="mock-table"><span></span><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
      <div class="floating-card floating-card-one"><span>统计状态</span><strong>可诊断</strong><small>失败不会静默丢失</small></div>
      <div class="floating-card floating-card-two"><span>目标状态</span><strong>实时检测</strong><small>显示真实响应结果</small></div>
    </div>
  </section>

  <section class="logo-proof"><p>一套系统覆盖完整链接生命周期</p><div><strong>创建</strong><strong>组织</strong><strong>分发</strong><strong>分析</strong><strong>恢复</strong></div></section>

  <section id="capabilities" class="section-shell section-white">
    <div class="section-heading center"><span>核心能力</span><h2>不是一个功能入口，而是一套完整工作流</h2><p>从创建、组织、分发到分析，每一个页面都围绕真实任务设计。</p></div>
    <div class="capability-grid">
      @foreach($features as $index => $feature)
        <article class="capability-card"><span class="capability-number">{{ str_pad($index+1,2,'0',STR_PAD_LEFT) }}</span><div class="capability-icon">{{ ['↗','⌁','◎','▦','⌘','◇'][$index%6] }}</div><h3>{{ $feature['title'] }}</h3><p>{{ $feature['description'] }}</p><a href="{{ auth()->check()?route('dashboard'):route('register') }}">了解实际操作 →</a></article>
      @endforeach
    </div>
  </section>

  <section class="section-shell">
    <div class="section-heading"><span>产品演示</span><h2>每一步都能看见、理解并控制</h2><p>关键设置不会隐藏在混乱的表单里，数据状态也不会用静态数字伪装。</p></div>
    <div class="feature-stories">
      @foreach(array_slice($features,0,4) as $index => $feature)
        <article class="feature-story {{ $index%2?'feature-story-reverse':'' }}">
          <div class="feature-story-copy"><span>0{{ $index+1 }}</span><h3>{{ $feature['title'] }}</h3><p>{{ $feature['description'] }}</p><ul><li>清晰的状态和错误原因</li><li>完整的创建、编辑、停用与恢复流程</li><li>真实数据驱动，不使用演示假记录</li></ul><a href="{{ auth()->check()?route('dashboard'):route('register') }}" class="btn-secondary">打开工作台 →</a></div>
          <div class="feature-story-demo">
            @if($index===0)
              <div class="demo-link-builder"><label>目标网址</label><div>https://example.com/campaign</div><label>品牌短链</label><div class="split"><span>gojet.cc</span><b>/launch-2026</b></div><button>创建链接 →</button></div>
            @elseif($index===1)
              <div class="demo-analytics"><div class="demo-analytics-head"><span>真实数据界面示意</span><strong>访问趋势与维度</strong></div><div class="line-visual"><svg viewBox="0 0 400 140" preserveAspectRatio="none"><path d="M0,120 C40,110 60,75 95,88 S150,40 190,62 S250,22 290,44 S350,15 400,22" fill="none" stroke="currentColor" stroke-width="5"/></svg></div><div class="mini-bars"><span style="width:82%"></span><span style="width:64%"></span><span style="width:49%"></span></div></div>
            @elseif($index===2)
              <div class="demo-routing"><div><b>01</b><span>中国大陆 · 移动端</span><strong>国内落地页</strong></div><div><b>02</b><span>美国 · 英语</span><strong>Global page</strong></div><div><b>03</b><span>默认规则</span><strong>主站</strong></div></div>
            @else
              <div class="demo-domain"><span class="status-dot"></span><strong>go.brand.example</strong><small>域名已验证 · SSL 已签发</small><div><span>CNAME</span><code>origin.lnl.cc</code></div><button>查看 DNS 配置</button></div>
            @endif
          </div>
        </article>
      @endforeach
    </div>
  </section>

  <section class="workflow-section">
    <div class="section-heading center"><span>工作流程</span><h2>从创建到优化，只需要三个清楚的阶段</h2></div>
    <div class="workflow-grid">@foreach($workflow as $index=>$step)<article><b>{{ $index+1 }}</b><h3>{{ $step['title'] }}</h3><p>{{ $step['description'] }}</p>@if(!$loop->last)<i>→</i>@endif</article>@endforeach</div>
  </section>

  <section class="section-shell section-white">
    <div class="section-heading center"><span>适合谁</span><h2>同一套平台，服务不同角色的实际目标</h2></div>
    <div class="audience-grid">@foreach($audiences as $item)<article><div>✦</div><h3>{{ $item['title'] }}</h3><p>{{ $item['description'] }}</p></article>@endforeach</div>
  </section>

  <section class="security-band">
    <div><span>可靠性与安全</span><h2>链接可以很短，产品闭环不能缩水</h2><p>同步核心统计、持久化事件流、失败日志、邮件诊断、权限隔离和审计记录共同保证系统可恢复、可解释。</p></div>
    <div class="security-checks"><span>✓ 同步核心点击计数</span><span>✓ Durable Spool 持久事件</span><span>✓ 邮件失败可诊断</span><span>✓ 工作区权限隔离</span><span>✓ 目标地址安全检查</span><span>✓ 操作审计与导出</span></div>
  </section>

  <section class="faq-section">
    <div class="section-heading center"><span>常见问题</span><h2>关于这项能力，你可能还想知道</h2></div>
    <div class="faq-list" x-data="{open:0}">@foreach($faq as $index=>$item)<article><button @click="open=open==={{ $index }}?-1:{{ $index }}"><span>{{ $item['q'] }}</span><b x-text="open==={{ $index }}?'−':'+'"></b></button><p x-cloak x-show="open==={{ $index }}">{{ $item['a'] }}</p></article>@endforeach</div>
  </section>
</x-layouts.marketing>
