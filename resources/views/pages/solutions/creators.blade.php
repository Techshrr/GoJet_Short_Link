@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'创作者与个人品牌':'Creators and personal brands'" :title="$zh?'用一个品牌入口连接全部内容':'Connect every piece of content through one branded presence'" :description="$zh?'个人主页、短链接、二维码、文本、文件、自定义域名和访问分析帮助创作者建立独立品牌资产。':'Profile pages, short links, QR codes, text, files, custom domains, and analytics help creators own their brand presence.'" :features="[
['title'=>$zh?'个人主页':'Profile pages','description'=>$zh?'通过主题和区块集中展示作品、社交平台和联系方式。':'Show work, social profiles, and contact information through themes and blocks.'],
['title'=>$zh?'内容短链':'Content links','description'=>$zh?'为视频、文章、商店和订阅入口创建统一品牌链接。':'Create consistent branded links for videos, articles, shops, and subscriptions.'],
['title'=>$zh?'数字与线下二维码':'Digital and print QR','description'=>$zh?'在视频、海报、名片和活动现场使用可更新二维码。':'Use editable QR codes in videos, posters, cards, and live events.'],
['title'=>$zh?'资料与下载':'Resources and downloads','description'=>$zh?'分享媒体包、作品集、简历、配置和资料。':'Share media kits, portfolios, resumes, configurations, and resources.'],
['title'=>$zh?'受众洞察':'Audience insight','description'=>$zh?'了解访问来源、终端、地区和最受欢迎的区块。':'Understand referrers, devices, locations, and the most popular blocks.'],
['title'=>$zh?'独立域名':'Own domain','description'=>$zh?'避免把长期品牌资产完全依赖在第三方平台。':'Avoid placing long-term brand assets entirely on third-party platforms.'],
]" />