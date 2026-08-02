@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'品牌链接管理':'Branded link management'" :title="$zh?'远不止缩短网址':'Much more than shortening URLs'" :description="$zh?'通过品牌域名、活动、文件夹、标签、批量导入、动态编辑和健康检测管理每一个链接。':'Manage every link with branded domains, campaigns, folders, tags, bulk import, editable destinations, and health monitoring.'" :features="[
['title'=>$zh?'完整链接工作台':'Complete link workspace','description'=>$zh?'搜索、筛选、排序、分页、卡片与批量操作覆盖链接完整生命周期。':'Search, filter, sort, paginate, and batch-manage the full link lifecycle.'],
['title'=>$zh?'品牌域名':'Branded domains','description'=>$zh?'验证自定义域名、跟踪证书状态并为不同品牌配置默认域名。':'Verify custom domains, track certificates, and assign defaults for each brand.'],
['title'=>$zh?'高级控制':'Advanced controls','description'=>$zh?'支持 301/302/307/308、密码、到期、定时生效、点击上限、归档和恢复。':'Use 301/302/307/308, passwords, expiry, activation schedules, click limits, archive, and restore.'],
['title'=>$zh?'活动与分类':'Campaign organization','description'=>$zh?'使用活动、嵌套文件夹、标签、说明和团队备注组织大量链接。':'Organize large collections with campaigns, nested folders, tags, descriptions, and team notes.'],
['title'=>$zh?'批量迁移':'Bulk migration','description'=>$zh?'通过 CSV 导入和导出大规模创建、迁移或备份链接资产。':'Create, migrate, or back up link assets at scale through CSV import and export.'],
['title'=>$zh?'目标健康检测':'Destination health','description'=>$zh?'记录 HTTP 状态、故障详情、页面标题、描述、图片和网站图标。':'Track HTTP status, failure details, page title, description, image, and favicon metadata.'],
]" :workflow="[
['title'=>$zh?'输入目标地址':'Enter a destination','description'=>$zh?'选择品牌域名和短码，并附加内部标题与分类。':'Choose a branded domain and short code, then add internal titles and organization.'],
['title'=>$zh?'配置访问控制':'Configure controls','description'=>$zh?'设置跳转类型、密码、时间、上限、UTM 和二维码样式。':'Set redirect type, password, schedule, limits, UTM, and QR design.'],
['title'=>$zh?'发布和持续管理':'Publish and manage','description'=>$zh?'目标地址可随时更新而无需改变已经投放的短链接。':'Update destinations at any time without changing the published short URL.'],
]" />