# 链接活动、文件夹与标签

链接组织数据以工作区隔离。创建和批量修改要求 Owner、Admin 或 Editor 权限；Analyst 与 Viewer 只能查看。所有批量修改和资源创建都会写入 `audit_logs`。

## 数据与接口

- `GET /api/workspaces/{id}/organization` 返回活动、文件夹和标签；活动点击量实时汇总 Redis 的真实链接计数。
- `POST /api/workspaces/{id}/campaigns` 创建活动，并且只在响应中返回一次不可猜测的转化 Token。
- `PATCH /api/workspaces/{id}/campaigns/{campaign}` 在进行中、暂停、完成状态之间切换。
- `POST /api/workspaces/{id}/folders` 与 `POST /api/workspaces/{id}/tags` 创建组织资源。
- `PATCH /api/workspaces/{id}/links/bulk-move` 批量设置或清除文件夹和活动。
- `PATCH /api/workspaces/{id}/links/bulk-tags` 原子替换选中链接的标签集合。
- `DELETE /api/workspaces/{id}/links/bulk` 软删除链接并立即同步 Redis 为停用，不破坏历史分析事件。
- `GET /api/workspaces/{id}/links/export.csv` 按当前搜索与组织筛选导出最多一万条真实链接记录。

创建链接时传入的 `folder_id`、`campaign_id` 和所有 `tag_ids` 都会验证是否属于当前工作区，不能利用其他工作区的资源编号建立越权关联。

## 转化回传

外部转化服务调用 `POST /api/public/campaigns/{campaign}/conversion`，JSON 请求体为 `{"token":"<创建活动时返回的 Token>"}`。服务只接受进行中的活动和 SHA-256 匹配的 Token，并按来源 IP 与 User-Agent 在 Redis 中做 24 小时去重。Nginx 另设每 IP 的转化回传速率限制。Token 不会再次通过列表接口返回；遗失后应新建活动，而不是把 Token 写入公开网页源码。
