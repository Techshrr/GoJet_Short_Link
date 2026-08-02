@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'品牌个人主页':'Branded profile pages'" :title="$zh?'一个页面集中承载你的所有重要入口':'Put every important destination on one branded page'" :description="$zh?'创建多个个人主页，通过原创主题、品牌颜色、头像、简介、可排序区块、定时内容和自定义域名展示品牌。':'Create multiple profile pages with original themes, brand colors, avatars, bios, sortable blocks, scheduled content, and custom domains.'" :features="[
['title'=>$zh?'多主页管理':'Multiple profiles','description'=>$zh?'同一工作区可以为不同品牌、活动和成员创建独立主页。':'Create separate pages for brands, campaigns, and members in one workspace.'],
['title'=>$zh?'原创主题':'Independent themes','description'=>$zh?'Aurora、Minimal、Midnight、Paper 和 Contrast 等 GoJet 设计主题。':'Use GoJet-designed Aurora, Minimal, Midnight, Paper, and Contrast themes.'],
['title'=>$zh?'可组合区块':'Composable blocks','description'=>$zh?'链接、标题、文本、图片、视频、嵌入、联系方式和社交入口自由组合。':'Combine links, headings, text, images, video, embeds, contact, and social blocks.'],
['title'=>$zh?'排序和定时':'Ordering and schedules','description'=>$zh?'调整区块顺序，并按时间自动显示或隐藏。':'Reorder blocks and show or hide them on a schedule.'],
['title'=>$zh?'品牌域名':'Branded domains','description'=>$zh?'把主页绑定到已验证域名，并保持与短链接一致的品牌。':'Bind pages to verified domains and maintain consistent link branding.'],
['title'=>$zh?'页面分析':'Page analytics','description'=>$zh?'记录页面访问和每个区块的点击表现。':'Measure page views and clicks for every content block.'],
]" />