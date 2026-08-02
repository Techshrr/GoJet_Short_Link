@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'开发者平台':'Developer platform'" :title="__('v3.public.developers_title')" :description="$zh?'通过版本化 REST API、细粒度 Token、签名 Webhook、转化事件和投递日志把 GoJet 接入产品与工作流。':'Connect GoJet to products and workflows through versioned REST APIs, scoped tokens, signed webhooks, conversion events, and delivery logs.'" :features="[
['title'=>'REST API v1','description'=>$zh?'覆盖链接、分流、分析、域名、文本、文件、个人主页、Webhook 和转化事件。':'Covers links, routing, analytics, domains, text, files, profiles, webhooks, and conversions.'],
['title'=>$zh?'权限范围 Token':'Scoped tokens','description'=>$zh?'Token 可撤销、可到期，并按 read/write 与产品模块授权。':'Tokens are revocable, expiring, and scoped by read/write operation and product module.'],
['title'=>$zh?'签名 Webhook':'Signed webhooks','description'=>$zh?'使用时间戳和 HMAC-SHA256 签名，记录响应并自动重试。':'Use timestamped HMAC-SHA256 signatures with response logging and retries.'],
['title'=>$zh?'转化事件':'Conversion events','description'=>$zh?'上报注册、购买、线索或自定义业务事件并关联目标版本。':'Report signup, purchase, lead, or custom events linked to routing variants.'],
['title'=>'OpenAPI','description'=>$zh?'机器可读规范用于生成客户端、测试和内部文档。':'A machine-readable specification supports clients, tests, and internal documentation.'],
['title'=>$zh?'自托管控制':'Self-hosted control','description'=>$zh?'接口、数据、日志和密钥全部保留在自己的基础设施中。':'Keep APIs, data, logs, and secrets inside your own infrastructure.'],
]" />