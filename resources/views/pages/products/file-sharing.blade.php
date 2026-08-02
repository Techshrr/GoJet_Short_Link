@php($zh=app()->getLocale()==='zh_CN')
<x-product-page :kicker="$zh?'安全文件分享':'Secure file sharing'" :title="$zh?'用可控短链接分发文件':'Distribute files through controlled short links'" :description="$zh?'连接本地、S3、R2 或 MinIO，支持私有存储、分片上传、密码、到期、下载上限、文件哈希和恶意文件扫描接口。':'Connect local, S3, R2, or MinIO storage with private objects, resumable uploads, passwords, expiry, download limits, hashes, and malware-scanner integration.'" :features="[
['title'=>$zh?'多存储适配':'Storage adapters','description'=>$zh?'默认本地私有存储，并支持 AWS S3、Cloudflare R2 与其他兼容端点。':'Use private local storage by default, with AWS S3, Cloudflare R2, and other compatible endpoints.'],
['title'=>$zh?'分片与断点续传':'Resumable chunks','description'=>$zh?'大文件按分片上传，服务器校验完整大小后再生成分享资源。':'Upload large files in chunks and assemble only after size verification.'],
['title'=>$zh?'下载控制':'Download controls','description'=>$zh?'密码、到期、下载上限、私有可见性和安全响应头。':'Use passwords, expiry, download limits, private visibility, and hardened response headers.'],
['title'=>$zh?'安全策略':'Security policy','description'=>$zh?'阻止常见可执行和脚本扩展名，并预留恶意文件扫描接口。':'Block common executable and script extensions with a malware-scanner interface.'],
['title'=>$zh?'哈希和完整性':'Hash and integrity','description'=>$zh?'保存 SHA-256，便于校验文件完整性和执行哈希黑名单。':'Store SHA-256 for integrity validation and hash blocklists.'],
['title'=>$zh?'安全预览':'Safe preview','description'=>$zh?'只有图片、PDF 和文本等允许类型可以内联预览。':'Only permitted image, PDF, and text types may render inline.'],
]" />