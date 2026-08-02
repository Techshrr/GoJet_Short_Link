@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'市场营销':'Marketing'" :title="$zh?'从投放链接到转化结果形成闭环':'Connect campaign links to measurable conversions'" :description="$zh?'通过活动、UTM、品牌域名、二维码、智能分流、实时分析和转化 API 管理营销投放。':'Manage campaigns with UTM, branded domains, QR codes, smart routing, realtime analytics, and conversion APIs.'" :features="[
['title'=>$zh?'活动工作区':'Campaign workspace','description'=>$zh?'使用活动、文件夹、标签和批量导入管理渠道资产。':'Manage channel assets with campaigns, folders, tags, and bulk import.'],
['title'=>$zh?'渠道参数':'Channel attribution','description'=>$zh?'标准化 UTM 来源、媒介、活动、内容和关键词。':'Standardize UTM source, medium, campaign, content, and term.'],
['title'=>$zh?'A/B 实验':'A/B experiments','description'=>$zh?'通过稳定权重分流比较不同落地页。':'Compare landing pages with stable weighted routing.'],
['title'=>$zh?'地域和设备优化':'Geo and device optimization','description'=>$zh?'按市场和访问环境自动选择目标。':'Automatically select destinations by market and visitor environment.'],
['title'=>$zh?'转化跟踪':'Conversion tracking','description'=>$zh?'通过 API 记录注册、购买、线索和自定义事件。':'Record signups, purchases, leads, and custom events through the API.'],
['title'=>$zh?'报表导出':'Reporting export','description'=>$zh?'导出活动和链接统计，连接团队现有分析流程。':'Export campaign and link data into existing analytics workflows.'],
]" />