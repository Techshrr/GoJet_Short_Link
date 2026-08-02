@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'智能分流与实验':'Smart routing and experiments'" :title="$zh?'让不同访问者看到最合适的目标':'Send every visitor to the right destination'" :description="$zh?'按照地理位置、设备、系统、浏览器、语言、来源、参数和时间进行路由，或用权重开展 A/B 实验。':'Route by geography, device, OS, browser, language, referrer, query, and time, or run weighted A/B experiments.'" :features="[
['title'=>$zh?'地理路由':'Geographic routing','description'=>$zh?'按国家、地区和城市选择目标。':'Choose destinations by country, region, and city.'],
['title'=>$zh?'设备与环境':'Device context','description'=>$zh?'按设备、系统、浏览器和语言优化体验。':'Optimize by device, operating system, browser, and language.'],
['title'=>$zh?'来源与参数':'Referrer and query','description'=>$zh?'根据来源网站和查询参数匹配营销场景。':'Match marketing scenarios through referrers and query parameters.'],
['title'=>$zh?'时间规则':'Schedules','description'=>$zh?'使用时区、日期、星期和时间窗口控制路由。':'Control routing with time zones, dates, weekdays, and time windows.'],
['title'=>$zh?'稳定权重实验':'Stable weighted tests','description'=>$zh?'同一访客稳定进入同一版本，减少实验噪声。':'Keep a visitor in the same variant to reduce experiment noise.'],
['title'=>$zh?'模拟与回滚':'Simulation and rollback','description'=>$zh?'上线前模拟规则，停用后立即回退默认目标。':'Simulate rules before release and fall back immediately when disabled.'],
]" :workflow="[
['title'=>$zh?'添加多个目标':'Add destinations','description'=>$zh?'为每个目标设置名称、权重、状态和回退属性。':'Set names, weights, status, and fallback behavior.'],
['title'=>$zh?'定义优先规则':'Define prioritized rules','description'=>$zh?'从高到低匹配访问者上下文。':'Match visitor context from highest to lowest priority.'],
['title'=>$zh?'分析实验结果':'Analyze outcomes','description'=>$zh?'比较目标点击、独立访客和转化事件。':'Compare clicks, unique visitors, and conversion events.'],
]" />