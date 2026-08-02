@php($zh=app()->getLocale()==='zh_CN')
<x-product-page
  :kicker="$zh?'受控流量实验':'Controlled traffic experiments'"
  :title="$zh?'用真实流量验证每一个落地页':'Validate every destination with real traffic'"
  :description="$zh?'为同一个短链接配置多个目标和权重，在不更换投放素材的情况下逐步找到更有效的版本。':'Assign weighted destinations to one short link and identify the stronger experience without replacing published campaign assets.'"
  :features="[
    ['title'=>$zh?'加权流量分配':'Weighted allocation','description'=>$zh?'为每个目标设置明确权重，并在发布前检查总权重。':'Assign explicit weights and validate the allocation before publishing.'],
    ['title'=>$zh?'随时调整实验':'Editable experiments','description'=>$zh?'保持短链不变，暂停目标或调整权重，避免重新投放。':'Keep the public URL stable while pausing variants or changing weights.'],
    ['title'=>$zh?'目标级归因':'Destination attribution','description'=>$zh?'在链接分析中心比较各目标的访问与转化结果。':'Compare visits and conversion outcomes for every destination.'],
    ['title'=>$zh?'规则优先级':'Rule precedence','description'=>$zh?'先执行设备、国家、语言和来源规则，再对匹配流量进行分配。':'Apply device, country, language, and referrer rules before weighted allocation.'],
    ['title'=>$zh?'安全停止':'Safe shutdown','description'=>$zh?'实验结束后可将全部流量切回主目标，无需删除历史数据。':'Return all traffic to the primary destination without deleting experiment history.'],
    ['title'=>$zh?'事件导出':'Event export','description'=>$zh?'导出含目标标识的访问事件，在外部系统完成进一步分析。':'Export visit events with destination identifiers for downstream analysis.'],
  ]"
  :workflow="[
    ['title'=>$zh?'添加实验目标':'Add variants','description'=>$zh?'为同一个链接添加两个或更多目标地址。':'Add two or more destinations to one link.'],
    ['title'=>$zh?'设置权重与规则':'Set weights and rules','description'=>$zh?'定义流量比例以及设备、地域或来源条件。':'Define traffic shares and optional device, region, or referrer conditions.'],
    ['title'=>$zh?'观察并收敛':'Measure and converge','description'=>$zh?'比较真实结果，逐步提高优胜目标的流量。':'Compare actual outcomes and gradually move traffic to the winner.'],
  ]"
  :audiences="[
    ['title'=>$zh?'增长团队':'Growth teams','description'=>$zh?'验证落地页、优惠和行动按钮。':'Test landing pages, offers, and calls to action.'],
    ['title'=>$zh?'产品团队':'Product teams','description'=>$zh?'比较新旧体验并保留统一入口。':'Compare experiences behind one stable entry point.'],
    ['title'=>$zh?'广告投放团队':'Media buyers','description'=>$zh?'不修改广告素材即可调整流量去向。':'Change traffic allocation without editing campaign creatives.'],
    ['title'=>$zh?'开发团队':'Developers','description'=>$zh?'通过 API 和事件导出接入内部实验体系。':'Connect internal experimentation through APIs and event exports.'],
  ]"
  :faq="[
    ['q'=>$zh?'调整权重会改变短链接吗？':'Do weight changes alter the short URL?','a'=>$zh?'不会，公开短链接保持不变，新的分配规则会应用于后续访问。':'No. The public short URL stays unchanged and the new allocation applies to subsequent visits.'],
    ['q'=>$zh?'可以暂停某个目标吗？':'Can a destination be paused?','a'=>$zh?'可以，停用目标后不会再向它分配新流量，已有统计仍会保留。':'Yes. Disabled destinations receive no new traffic while their historical analytics remain available.'],
    ['q'=>$zh?'如何区分各目标结果？':'How are destination results separated?','a'=>$zh?'每条访问事件记录实际命中的目标，可在分析中心查看或导出。':'Each event records the selected destination for in-product analysis and export.'],
  ]"
/>
