@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'二维码活动':'QR campaigns'" :title="$zh?'把线下触点连接到可持续优化的数字旅程':'Connect physical touchpoints to an optimizable digital journey'" :description="$zh?'为门店、包装、海报、会议和户外投放创建动态二维码，按地点、设备和时间分流，并独立分析扫码表现。':'Create dynamic QR codes for stores, packaging, posters, conferences, and outdoor media, route by context, and measure scans independently.'" :features="[
['title'=>$zh?'动态目标':'Editable destinations','description'=>$zh?'印刷后仍可修改目标，避免重新制作物料。':'Change destinations after printing without replacing materials.'],
['title'=>$zh?'活动批量管理':'Campaign batching','description'=>$zh?'通过 CSV 和活动分类一次创建大量二维码链接。':'Create large QR link inventories through CSV and campaigns.'],
['title'=>$zh?'地理与时间分流':'Geo and schedule routing','description'=>$zh?'同一二维码可在不同门店、地区和时段展示不同目标。':'One QR code can serve different destinations by location and schedule.'],
['title'=>$zh?'扫码独立统计':'Separate scan analytics','description'=>$zh?'区分扫码和普通点击，查看设备、地区、时间和转化。':'Separate QR scans from normal clicks and analyze device, geography, time, and conversions.'],
['title'=>$zh?'印刷级 SVG':'Print-ready SVG','description'=>$zh?'下载可缩放矢量文件，保持大型物料清晰。':'Download scalable vector files that remain sharp in large-format print.'],
['title'=>$zh?'安全治理':'Safety controls','description'=>$zh?'到期、密码、点击上限和黑名单同样适用于二维码目标。':'Apply expiry, passwords, click limits, and blocklists to QR destinations.'],
]" />