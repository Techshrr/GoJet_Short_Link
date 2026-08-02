@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'访问与转化分析':'Visit and conversion analytics'" :title="$zh?'知道链接被谁、从哪里、用什么访问':'Understand who visits, from where, and on what device'" :description="$zh?'在保护访客隐私的前提下，分析点击、独立访客、地理位置、设备、来源、UTM、二维码、目标分流和转化结果。':'Analyze clicks, unique visitors, geography, devices, referrers, UTM, QR scans, routing destinations, and conversions while respecting visitor privacy.'" :features="[
['title'=>$zh?'实时趋势':'Realtime trends','description'=>$zh?'按小时、天和自定义周期查看点击与独立访客趋势，并与历史周期比较。':'View clicks and unique visitors by hour, day, and custom ranges with period comparison.'],
['title'=>$zh?'地理分析':'Geographic analytics','description'=>$zh?'查看国家、地区、城市和地图分布，支持工作区、活动和单链接维度。':'Explore country, region, city, and map distribution by workspace, campaign, or link.'],
['title'=>$zh?'终端与环境':'Device environment','description'=>$zh?'识别设备类型、操作系统、浏览器和语言，帮助优化着陆体验。':'Measure device types, operating systems, browsers, and languages to optimize landing experiences.'],
['title'=>$zh?'来源与 UTM':'Referrers and UTM','description'=>$zh?'拆解来源网站、source、medium、campaign、content 和 term。':'Break down referrers and source, medium, campaign, content, and term dimensions.'],
['title'=>$zh?'机器人过滤':'Bot filtering','description'=>$zh?'区分原始点击、人类访问和机器人流量，避免预览机器人污染决策。':'Separate raw clicks, human visits, and bot traffic so preview bots do not distort decisions.'],
['title'=>$zh?'转化与实验':'Conversions and experiments','description'=>$zh?'通过 API 上报转化事件，比较不同目标的点击、转化率和价值。':'Track conversions through the API and compare destination clicks, rates, and value.'],
]" :workflow="[
['title'=>$zh?'采集最少必要数据':'Collect only what is needed','description'=>$zh?'IP 通过密钥哈希，不保存原始地址，并支持保留周期。':'IP addresses are keyed-hashed instead of stored raw, with configurable retention.'],
['title'=>$zh?'聚合多维报表':'Aggregate dimensions','description'=>$zh?'核心计数同步落库，Go 跳转面通过耐久磁盘队列保障事件可恢复，再生成趋势、独立访客和维度报表。':'Core counts persist synchronously while the Go redirect plane uses a durable disk spool for recoverable event delivery.'],
['title'=>$zh?'导出或接入 API':'Export or use the API','description'=>$zh?'在控制台查看、下载 CSV，或通过版本化 API 拉取数据。':'Review dashboards, export CSV, or retrieve data through the versioned API.'],
]" />