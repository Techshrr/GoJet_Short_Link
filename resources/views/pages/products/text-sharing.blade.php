@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'文本与代码分享':'Text and code sharing'" :title="$zh?'快速分享文本、Markdown 和代码片段':'Share text, Markdown, and code without friction'" :description="$zh?'用短地址发布内容，并通过密码、到期时间、访问上限、阅后即焚、原始视图、下载和修订历史控制生命周期。':'Publish content at a short address with passwords, expiry, view limits, burn-after-read, raw views, downloads, and revision history.'" :features="[
['title'=>$zh?'三种内容格式':'Three content modes','description'=>$zh?'纯文本、Markdown 和代码模式覆盖说明、文档、配置与代码片段。':'Plain text, Markdown, and code cover notes, documents, configuration, and snippets.'],
['title'=>$zh?'访问控制':'Access controls','description'=>$zh?'支持公开、不公开列出、私有和密码访问。':'Support public, unlisted, private, and password-protected access.'],
['title'=>$zh?'生命周期':'Lifecycle controls','description'=>$zh?'设置到期、最大访问次数或非所有者读取后销毁。':'Set expiry, maximum views, or destruction after the first non-owner view.'],
['title'=>$zh?'原始和下载':'Raw and download','description'=>$zh?'提供纯文本原始响应和安全附件下载。':'Provide raw plain-text responses and safe attachment downloads.'],
['title'=>$zh?'修订历史':'Revision history','description'=>$zh?'每次更新前保存上一版本，方便审计和恢复。':'Save the prior version before each update for auditing and recovery.'],
['title'=>$zh?'API 支持':'API support','description'=>$zh?'通过版本化接口创建、读取、更新和删除文本分享。':'Create, read, update, and delete text shares through the versioned API.'],
]" />