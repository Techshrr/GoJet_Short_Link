<x-layouts.marketing title="强大的链接管理，触手可及" description="缩短 URL、分享文本和文件、管理二维码与品牌域名，并理解每一次访问。">
  <section class="home-hero">
    <div class="hero-aura"></div>
    <div class="home-hero-inner">
      <span class="badge-mint">产品 / 演示</span>
      <h1>强大的 <em>链接管理</em> 触手可及</h1>
      <p>缩短 URL、分享文本和文件、掌握每一次点击——都在同一个平台。</p>
      <div class="hero-product-tabs"><span class="active">↗ 缩短 URL</span><span>▤ 分享文本</span><span>⇧ 上传文件</span><span>♙ 个人主页</span></div>
      <form class="hero-shortener" method="{{ auth()->check() ? 'post' : 'get' }}" action="{{ auth()->check() ? route('links.store') : route('register') }}">
        @auth @csrf @endauth
        <input type="url" name="target_url" placeholder="https:// 粘贴长 URL 进行缩短" required>
        <button type="submit">创建链接 <b>→</b></button>
      </form>
      <div class="hero-subactions">@guest<a href="{{ route('register') }}">免费注册开始使用 →</a>@endguest<a href="{{ route('pricing') }}">查看方案</a></div>
      <small>大量使用或定制需求？ <a href="{{ route('contact') }}">获取报价 →</a></small>
      <div class="brand-proof"><p>为需要长期掌控链接资产的团队而设计</p><div><b>品牌短链</b><b>动态二维码</b><b>真实分析</b><b>可自托管</b></div></div>
    </div>
  </section>

  <section class="home-products section-white">
    <div class="section-heading center"><span>什么是 GoJet</span><h2>不只是缩短网址，而是完整的链接基础设施</h2><p>所有入口都连接真实的创建、管理、分析和恢复流程。</p></div>
    <div class="product-stack">
      <article><div><span>核心产品</span><h3>缩短网址并保持随时可编辑</h3><p>使用品牌域名和自定义短码创建链接，设置跳转类型、密码、有效期、点击上限、UTM、标签和活动。</p><a href="{{ route('products.url-shortener') }}" class="btn-primary">探索短网址 →</a></div><div class="stack-demo demo-shortener-ui"><div class="stack-window"><label>目标 URL</label><div class="url-row">https://example.com/product/launch</div><div class="two-cols"><div><label>域名</label><span>gojet.cc</span></div><div><label>短码</label><span>launch</span></div></div><button>创建品牌链接 →</button></div></div></article>
      <article class="reverse"><div><span>个人品牌</span><h3>用一个页面连接全部内容</h3><p>通过模块化区块、主题、自定义域名和点击分析建立可长期持有的品牌入口。</p><a href="{{ route('products.link-in-bio') }}" class="btn-primary">探索个人主页 →</a></div><div class="stack-demo profile-preview"><div class="phone-shell"><div class="phone-profile"><b>G</b><h4>Ethan Studio</h4><p>产品、设计与独立开发</p><a>最新产品发布</a><a>我的博客</a><a>联系与合作</a></div></div><div class="profile-stats"><span><b>—</b>真实访问</span><span><b>—</b>真实点击率</span></div></div></article>
      <article><div><span>内容分享</span><h3>文本、代码和文件都能用短地址分享</h3><p>支持 Markdown、代码高亮、密码、到期时间、访问次数、阅后即焚、文件扫描和下载限制。</p><div class="inline-links"><a href="{{ route('products.text-sharing') }}">文本分享 →</a><a href="{{ route('products.file-sharing') }}">文件分享 →</a></div></div><div class="stack-demo share-preview"><div class="editor-card"><div class="editor-head"><span></span><span></span><span></span><b>README.md</b></div><pre># GoJet API

Create links with one request.

POST /api/v1/links</pre></div><div class="file-card"><b>brand-assets.zip</b><span>文件状态与扫描结果实时显示</span><button>下载文件</button></div></div></article>
      <article class="reverse"><div><span>二维码</span><h3>印刷后仍可更新目标的动态二维码</h3><p>生成 PNG 与 SVG，区分扫码和普通点击，按门店、设备、国家与时间自动分流。</p><a href="{{ route('products.qr') }}" class="btn-primary">探索二维码 →</a></div><div class="stack-demo qr-preview"><div class="fake-qr">@for($i=0;$i<81;$i++)<i class="{{ in_array($i%9,[0,1,4,7,8]) || in_array(intdiv($i,9),[0,1,4,7,8]) ? 'on':'' }}"></i>@endfor</div><div class="qr-panel"><span class="badge-success">界面示意</span><h4>夏季门店活动</h4><div><span>数据来源</span><b>真实扫码事件</b></div><div><span>分析结果</span><b>访问与转化</b></div></div></div></article>
    </div>
  </section>

  <section class="advanced-section">
    <div class="section-heading center"><span>高级链接管理</span><h2>从创建一个链接，升级为管理一套增长资产</h2><p>规则、分析、团队和自动化在同一个产品体系中工作。</p></div>
    <div class="advanced-grid">
      <article class="wide"><div><span>数据分析</span><h3>理解每一次访问来自哪里</h3><p>查看来源网站、Direct、国家、地区、城市、设备、浏览器、系统、语言、UTM、机器人与二维码访问。</p><a href="{{ route('products.analytics') }}">查看链接分析 →</a></div><div class="analytics-board"><div class="analytics-board-head"><span>真实数据界面示意</span><b>访问趋势与来源</b></div><svg viewBox="0 0 600 180" preserveAspectRatio="none"><path d="M0,155 C65,150 70,108 125,120 S205,68 255,88 S335,35 380,62 S470,18 520,38 S570,14 600,18" fill="none" stroke="currentColor" stroke-width="5"/></svg><div class="analytics-legend"><span>直接访问</span><span>搜索来源</span><span>社交媒体</span></div></div></article>
      <article><span>智能路由</span><h3>让同一个链接自动适配访问者</h3><p>按国家、设备、语言、来源、时间和权重选择不同目标。</p><div class="rule-list"><b>中国大陆 + 移动端 <i>→ 国内页</i></b><b>US + English <i>→ Global</i></b><b>默认规则 <i>→ Main</i></b></div><a href="{{ route('products.smart-routing') }}">了解智能链接 →</a></article>
      <article><span>自定义域名</span><h3>把每一次分享都变成品牌曝光</h3><p>DNS 验证、SSL 证书、默认域名和异常状态集中管理。</p><div class="domain-status"><i></i><b>go.brand.example</b><small>验证与证书状态实时显示</small></div><a href="{{ route('products.custom-domains') }}">管理品牌域名 →</a></article>
      <article><span>团队协作</span><h3>工作区、角色和审计</h3><p>隔离不同品牌与客户资产，控制所有者、管理员、编辑者、分析员和查看者权限。</p><div class="avatar-row"><i>E</i><i>A</i><i>J</i><i>+7</i></div><a href="{{ route('solutions.teams') }}">查看团队方案 →</a></article>
      <article><span>开发者能力</span><h3>API、Token 与 Webhook</h3><p>使用可撤销 Token 接入内部系统，并通过 Webhook 接收关键事件。</p><pre><code>POST /api/v1/links
Authorization: Bearer gjt_••••</code></pre><a href="{{ route('developers') }}">查看开发者 API →</a></article>
    </div>
  </section>

  <section class="why-section section-white">
    <div class="why-copy"><span>为什么要构建 GoJet</span><h2>链接看似简单，但它连接着品牌、流量和收入</h2><p>真正可用的链接产品不能只停留在生成短码。它必须能管理目标变化、处理访问规则、解释数据、保护品牌并在故障后恢复。</p><blockquote>链接短，产品闭环不能短。</blockquote></div>
    <div class="why-visual"><div class="phone-network"><div class="network-core">◎</div><span class="n1">↗</span><span class="n2">⌁</span><span class="n3">▦</span><span class="n4">✉</span><span class="n5">◎</span></div></div>
  </section>

  <section class="pricing-preview">
    <div class="section-heading center"><span>简单透明的价格</span><h2>从个人使用到企业级治理</h2><p>按月或按年选择方案，不使用模糊的隐藏配额。</p></div>
    <div class="pricing-preview-grid">
      @foreach([
        ['个人版','基础链接管理','适合个人项目与内容分享'],
        ['专业版','分析、域名与自动化','适合持续运营的品牌'],
        ['团队版','工作区、角色与审计','适合多人协作与代理机构'],
        ['企业版','定制配额与部署支持','适合严格治理与私有化'],
      ] as $index=>$plan)<article class="{{ $index===1?'featured':'' }}">@if($index===1)<span class="plan-hot">推荐</span>@endif<h3>{{ $plan[0] }}</h3><strong>{{ $plan[1] }}</strong><p>{{ $plan[2] }}</p><a href="{{ route('pricing') }}">查看当前方案 →</a></article>@endforeach
    </div>
  </section>

  <section class="testimonials section-white">
    <div class="section-heading center"><span>产品原则</span><h2>不使用假数据，不把未完成入口包装成能力</h2><p>GoJet 的每一个页面都必须连接到真实的创建、保存、诊断、恢复和导出流程。</p></div>
    <div class="testimonial-grid"><article><b>真实闭环</b><div>01</div><p>链接访问、核心计数和事件持久化可以独立验证，任何失败都会留下可追踪记录。</p></article><article><b>明确状态</b><div>02</div><p>域名、邮件、队列、存储和证书显示真实状态与失败原因，而不是静态成功标签。</p></article><article><b>可持续运营</b><div>03</div><p>设置、审计、备份、升级与回滚属于产品本身，不依赖临时手工修补。</p></article></div>
  </section>

  <section class="faq-section">
    <div class="section-heading center"><span>常见问题</span><h2>开始使用前需要了解什么</h2></div>
    <div class="faq-list" x-data="{open:0}">
      @foreach([
        ['GoJet 只是短网址工具吗？','不是。它同时包含短网址、二维码、链接分析、智能路由、自定义域名、文本分享、文件分享、个人主页、团队工作区、API 和 Webhook。'],
        ['短链接创建后还能修改吗？','可以。公开短地址保持不变，目标、状态、有效期、密码、点击上限、UTM 和路由规则都能继续修改。'],
        ['点击数据会不会因为队列没启动一直是 0？','Laravel 跳转路径会同步写入核心统计。启用 Go Redirect Plane 后，事件先写入持久化磁盘队列，再同步投递到控制面；数据库或网络恢复后会自动重试，不会把未落库访问伪装成成功统计。'],
        ['可以使用自己的域名吗？','可以。系统提供 DNS 验证、证书状态、自定义 404 和品牌配置。'],
        ['邮件发送失败会直接报 500 吗？','不会。验证邮件和测试邮件都会捕获异常、记录失败原因，并向用户显示可理解的错误。'],
        ['可以自托管吗？','可以。部署包包含 Laravel 控制面、Go 跳转面、MySQL、Redis、Nginx、队列、计划任务和分析消费者的 Docker Compose 配置。'],
      ] as $index=>$item)<article><button @click="open=open==={{ $index }}?-1:{{ $index }}"><span>{{ $item[0] }}</span><b x-text="open==={{ $index }}?'−':'+'"></b></button><p x-cloak x-show="open==={{ $index }}">{{ $item[1] }}</p></article>@endforeach
    </div>
  </section>
</x-layouts.marketing>
