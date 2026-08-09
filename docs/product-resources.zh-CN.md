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
| `GET` | `/api/workspaces/{id}/text-shares` | 列出工作区文本分享，不返回正文和密码哈希 |
| `GET/PUT/DELETE` | `/api/workspaces/{id}/text-shares/{share}` | 读取编辑内容、更新或软删除文本 |
| `POST` | `/api/public/text/{slug}` | 读取文本；密码放在 JSON 请求体中 |
| `GET/POST` | `/t/{slug}` | 安全渲染公开文本与密码验证页 |
| `POST` | `/api/workspaces/{id}/bio-pages` | 创建个人主页 |
| `GET` | `/api/workspaces/{id}/bio-pages` | 列出可编辑主页及结构化主题和模块 |
| `PUT/DELETE` | `/api/workspaces/{id}/bio-pages/{page}` | 更新、发布、暂停或软删除主页 |
| `GET` | `/api/public/bio/{slug}` | 读取已发布主页 |
| `GET` | `/p/{slug}` | 使用经过 URL 和主题校验的公开主页模板 |
| `POST` | `/api/workspaces/{id}/qr-codes` | 为工作区内的短链接生成二维码 |
| `GET/DELETE` | `/api/workspaces/{id}/qr-codes[/{qr}]` | 查看真实 QR 访问次数或删除二维码图片 |
| `POST` | `/api/workspaces/{id}/file-shares` | 上传文件并返回 `202` 扫描中状态 |
| `GET` | `/api/workspaces/{id}/file-shares` | 查看工作区文件和扫描、下载状态 |
| `GET` | `/api/public/files/{slug}` | 下载已通过扫描且未过期、未超限的文件 |
| `GET` | `/api/admin/files` | 查看扫描队列、异常和病毒结果 |
| `POST` | `/api/admin/files/{id}/retry-scan` | 仅重试扫描异常；病毒文件不可恢复 |

生产环境必须把 `PUBLIC_BASE_URL` 配置为用户实际访问短链接的 HTTPS 基础地址。生成的二维码文件保存在 `UPLOAD_STORAGE_PATH` 挂载卷，并通过现有 `/uploads/` 静态路由公开。

文件存储使用独立的 `FILE_STORAGE_PATH` 卷，绝不能挂载到公开 Web 根目录。默认单文件上限为 100MB，服务端根据文件内容重新检测 MIME 类型，不信任浏览器提交的类型。扫描连接失败会指数退避并最多自动尝试五次；Worker 中断导致的扫描租约会在十分钟后自动重新入队。后台概览暴露积压与失败数量，管理员只能重试技术错误，不能把病毒检测结果手动改为安全。

公开文本使用 `html/template` 转义后放入 `pre`，Markdown 和代码不会作为任意 HTML 执行。公开个人主页只接受 HTTP(S) 链接，主题颜色必须符合 `#RRGGBB`；响应设置限制脚本、框架和表单来源的 CSP。二维码目标带由 `QR_TRACKING_KEY` 计算的 HMAC 标记，Redirect Engine 只有在签名匹配链接 ID、域名和短码时才以 `visit_type=qr` 写入可靠事件流，伪造查询参数仍按普通跳转记录。生产环境必须为 Platform API 与 Redirect Engine 配置相同且至少 32 字符的独立二维码追踪密钥。
