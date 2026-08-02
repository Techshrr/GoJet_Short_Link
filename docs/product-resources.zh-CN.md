# 产品资源服务

GoJet 的文本分享、个人主页和二维码使用真实数据库记录，不向仪表盘注入演示数据。执行 `database/migrations/009_product_resources.sql` 后，平台 API 提供以下能力：

- 文本分享支持纯文本、Markdown 与代码，支持 bcrypt 密码、有效期和原子化一次性读取。
- 个人主页将主题和内容区块保存为 JSON，只有 `published` 状态可通过公开 API 读取。
- 二维码从工作区内真实短链接生成 PNG；自定义域名优先，否则使用 `PUBLIC_BASE_URL`。
- 文件上传后只写入不对 Nginx 暴露的隔离卷。独立 Worker 使用 ClamAV `INSTREAM` 扫描；只有扫描结果为 `clean` 的文件才能下载。
- 所有创建接口都复用工作区角色权限，分析员和只读成员不能写入资源。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/workspaces/{id}/text-shares` | 创建文本分享 |
| `POST` | `/api/public/text/{slug}` | 读取文本；密码放在 JSON 请求体中 |
| `POST` | `/api/workspaces/{id}/bio-pages` | 创建个人主页 |
| `GET` | `/api/public/bio/{slug}` | 读取已发布主页 |
| `POST` | `/api/workspaces/{id}/qr-codes` | 为工作区内的短链接生成二维码 |
| `POST` | `/api/workspaces/{id}/file-shares` | 上传文件并返回 `202` 扫描中状态 |
| `GET` | `/api/workspaces/{id}/file-shares` | 查看工作区文件和扫描、下载状态 |
| `GET` | `/api/public/files/{slug}` | 下载已通过扫描且未过期、未超限的文件 |
| `GET` | `/api/admin/files` | 查看扫描队列、异常和病毒结果 |
| `POST` | `/api/admin/files/{id}/retry-scan` | 仅重试扫描异常；病毒文件不可恢复 |

生产环境必须把 `PUBLIC_BASE_URL` 配置为用户实际访问短链接的 HTTPS 基础地址。生成的二维码文件保存在 `UPLOAD_STORAGE_PATH` 挂载卷，并通过现有 `/uploads/` 静态路由公开。

文件存储使用独立的 `FILE_STORAGE_PATH` 卷，绝不能挂载到公开 Web 根目录。默认单文件上限为 100MB，服务端根据文件内容重新检测 MIME 类型，不信任浏览器提交的类型。扫描连接失败会指数退避并最多自动尝试五次；Worker 中断导致的扫描租约会在十分钟后自动重新入队。后台概览暴露积压与失败数量，管理员只能重试技术错误，不能把病毒检测结果手动改为安全。
