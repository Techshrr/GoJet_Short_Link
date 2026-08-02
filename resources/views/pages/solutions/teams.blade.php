@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'团队与代理机构':'Teams and agencies'" :title="$zh?'让多人协作不再依赖共享账号':'Collaborate without sharing one account'" :description="$zh?'通过工作区、成员邀请、角色权限、资产隔离、审计记录、套餐配额和 API 管理多个品牌与客户。':'Use workspaces, invitations, roles, asset isolation, audit history, quotas, and APIs to manage brands and clients.'" :features="[
['title'=>$zh?'工作区隔离':'Workspace isolation','description'=>$zh?'链接、域名、活动、文件、主页、Token 和 Webhook 按品牌隔离。':'Separate links, domains, campaigns, files, profiles, tokens, and webhooks by brand.'],
['title'=>$zh?'角色权限':'Role-based access','description'=>$zh?'所有者、管理员、编辑者、分析者和查看者承担不同职责。':'Owners, admins, editors, analysts, and viewers receive different responsibilities.'],
['title'=>$zh?'邀请生命周期':'Invitation lifecycle','description'=>$zh?'邮件邀请、指定邮箱接受、角色调整和安全移除。':'Invite by email, require matching-account acceptance, update roles, and remove securely.'],
['title'=>$zh?'套餐和配额':'Plans and quotas','description'=>$zh?'按工作区限制链接、域名、文件、存储、成员和 API 使用量。':'Enforce workspace limits for links, domains, files, storage, members, and APIs.'],
['title'=>$zh?'操作审计':'Operational audit','description'=>$zh?'记录管理员和成员对关键资源的操作。':'Record administrator and member actions on important resources.'],
['title'=>$zh?'自动化接口':'Automation interfaces','description'=>$zh?'使用可撤销 Token、Webhook 和 API 接入内部流程。':'Connect internal workflows with revocable tokens, webhooks, and APIs.'],
]" />