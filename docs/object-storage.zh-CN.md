# 文件对象存储与隔离

文件分享支持两种实现相同接口的存储后端：单机文件系统和 S3 兼容对象存储。生产多节点部署建议使用 S3；本地开发默认继续使用文件系统。

真实生命周期：

1. 上传内容先写入 `quarantine/`，此时数据库状态保持 `quarantined`，不能下载；
2. 任一 File Worker 从共享对象存储物化独立临时扫描文件，通过 clamd `INSTREAM` 扫描；
3. 只有扫描结果为安全时才将对象从 `quarantine/` 原子流程迁移到 `clean/`，随后将数据库状态更新为 `active`；
4. 如果数据库更新失败，Worker 尝试把对象移回隔离区，避免数据库仍在扫描中而对象已经公开；
5. 下载只允许读取 `clean/`，感染文件始终留在隔离前缀；
6. 用户删除后对象先移动到不可公开的 `deleted/` 前缀，默认保留 7 天；清理 Worker 到期后再永久删除对象与数据库记录；
7. 多 Worker 验收会用 3 个并行 Worker 扫描 25 个对象，验证 `SKIP LOCKED` 无重复领取、崩溃租约恢复、立即下线和到期清理。

生产环境配置 `FILE_STORAGE_DRIVER=s3`，并设置 `S3_ENDPOINT`、`S3_ACCESS_KEY`、`S3_SECRET_KEY`、`S3_BUCKET`、`S3_REGION` 和 `S3_SECURE`。Bucket 必须由部署流程预先创建；服务启动时会验证它真实存在，不会静默退回本地磁盘。
