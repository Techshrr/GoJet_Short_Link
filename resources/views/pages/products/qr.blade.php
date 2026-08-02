@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'动态二维码':'Dynamic QR codes'" :title="$zh?'二维码投放后，目标仍然可以更新':'Change the destination after the QR code is printed'" :description="$zh?'为每个链接生成可定制二维码，下载 PNG 或 SVG，并把扫描与普通链接访问分别统计。':'Generate customizable QR codes for every link, download PNG or SVG, and measure scans separately from normal link visits.'" :features="[
['title'=>$zh?'动态目标':'Dynamic destination','description'=>$zh?'二维码编码的是 GoJet 品牌链接，更新目标地址无需重新印刷。':'The QR encodes a GoJet branded link, so destinations can change without reprinting.'],
['title'=>$zh?'品牌样式':'Brand styling','description'=>$zh?'配置前景、背景、容错级别、留白、圆角和品牌标识。':'Configure foreground, background, error correction, quiet zone, shapes, and brand marks.'],
['title'=>$zh?'PNG 与 SVG':'PNG and SVG','description'=>$zh?'下载适合数字展示的 PNG 或适合印刷的矢量 SVG。':'Download PNG for digital use or scalable SVG for print production.'],
['title'=>$zh?'扫描分析':'Scan analytics','description'=>$zh?'二维码访问标记为独立类型，可分析设备、位置、时间和转化。':'QR traffic is marked separately for device, location, time, and conversion analysis.'],
['title'=>$zh?'批量二维码':'Bulk QR generation','description'=>$zh?'活动链接可以批量导出二维码及其对应短链接清单。':'Export campaign QR codes and their matching short-link inventory in bulk.'],
['title'=>$zh?'安全跳转':'Safe redirects','description'=>$zh?'沿用目标校验、黑名单、到期、密码和滥用治理能力。':'Use the same destination validation, blocklists, expiry, passwords, and abuse controls.'],
]" :workflow="[
['title'=>$zh?'创建品牌链接':'Create a branded link','description'=>$zh?'选择域名、短码、UTM 和访问控制。':'Choose a domain, short code, UTM, and access controls.'],
['title'=>$zh?'设计二维码':'Design the QR','description'=>$zh?'配置颜色、容错和输出格式，并实时预览。':'Configure colors, correction level, and output format with a live preview.'],
['title'=>$zh?'投放和跟踪':'Distribute and measure','description'=>$zh?'扫码后进入同一统计和智能路由链路。':'Scans enter the same analytics and smart-routing pipeline.'],
]" />