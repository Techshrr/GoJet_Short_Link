# 产品资源服务

GoJet 的文本分享、个人主页和二维码使用真实数据库记录，不向仪表盘注入演示数据。执行 `database/migrations/009_product_resources.sql` 后，平台 API 提供以下能力：

- 文本分享支持纯文本、Markdown 与代码，支持 bcrypt 密码、有效期和原子化一次性读取。
- 个人主页将主题和内容区块保存为 JSON，只有 `published` 状态可通过公开 API 读取。
- 二维码从工作区内真实短链接生成 PNG；自定义域名优先，否则使用 `PUBLIC_BASE_URL`。
- 所有创建接口都复用工作区角色权限，分析员和只读成员不能写入资源。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/workspaces/{id}/text-shares` | 创建文本分享 |
| `POST` | `/api/public/text/{slug}` | 读取文本；密码放在 JSON 请求体中 |
| `POST` | `/api/workspaces/{id}/bio-pages` | 创建个人主页 |
| `GET` | `/api/public/bio/{slug}` | 读取已发布主页 |
| `POST` | `/api/workspaces/{id}/qr-codes` | 为工作区内的短链接生成二维码 |

生产环境必须把 `PUBLIC_BASE_URL` 配置为用户实际访问短链接的 HTTPS 基础地址。生成的二维码文件保存在 `UPLOAD_STORAGE_PATH` 挂载卷，并通过现有 `/uploads/` 静态路由公开。
