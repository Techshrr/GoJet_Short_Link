@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'品牌域名':'Branded domains'" :title="$zh?'用自己的域名建立长期信任':'Build long-term trust with your own domains'" :description="$zh?'通过 DNS 验证所有权，跟踪证书生命周期，并让链接、二维码和个人主页共享统一品牌入口。':'Verify ownership through DNS, track certificate lifecycle, and give links, QR codes, and profile pages a consistent branded entry point.'" :features="[
['title'=>$zh?'TXT 所有权验证':'TXT ownership verification','description'=>$zh?'通过随机验证记录确认域名归属，防止未经授权绑定。':'Confirm domain ownership with a random verification record.'],
['title'=>$zh?'证书生命周期':'Certificate lifecycle','description'=>$zh?'跟踪待处理、签发、生效、错误和重试状态。':'Track pending, provisioning, active, error, and retry states.'],
['title'=>$zh?'Cloudflare 适配':'Cloudflare adapter','description'=>$zh?'可选接入 Custom Hostnames 自动配置证书和回退源。':'Optionally use Custom Hostnames for certificate provisioning and fallback origins.'],
['title'=>$zh?'通用外部证书':'Generic external TLS','description'=>$zh?'也可使用反向代理或外部证书模式，不强依赖单一供应商。':'Use reverse proxies or external TLS without locking into one provider.'],
['title'=>$zh?'域名级安全':'Domain safety','description'=>$zh?'禁止删除仍承载链接或主页的域名，并保留诊断错误。':'Prevent deletion while links or profiles still depend on the domain.'],
['title'=>$zh?'默认域名与品牌':'Default domain and branding','description'=>$zh?'按工作区配置默认短链域名，并为不同品牌隔离资产。':'Set workspace defaults and isolate assets across brands.'],
]" :workflow="[
['title'=>$zh?'添加完整主机名':'Add a hostname','description'=>$zh?'输入 go.brand.example 等完整域名。':'Enter a full hostname such as go.brand.example.'],
['title'=>$zh?'配置 DNS':'Configure DNS','description'=>$zh?'创建安装界面提供的 TXT 与 CNAME/A 记录。':'Create the TXT and CNAME/A records shown in the interface.'],
['title'=>$zh?'验证并启用':'Verify and activate','description'=>$zh?'证书可用后即可创建短链接和绑定主页。':'Create links and bind profiles after the certificate becomes active.'],
]" />