# 文件对象存储与隔离

文件分享支持两种实现同一安全接口的存储后端：单机文件系统和 S3 兼容对象存储。单机部署可以使用文件系统；多节点生产部署建议使用 S3 兼容对象存储。

## 文件安全生命周期

1. 上传内容先写入 `quarantine/`，数据库状态保持 `quarantined`，此时不能公开下载；
2. File Worker 从共享存储物化独立临时扫描文件，通过 clamd `INSTREAM` 扫描；
3. 只有扫描结果为安全时，才将对象从 `quarantine/` 迁移到 `clean/`，随后把数据库状态更新为 `active`；
4. 如果数据库状态更新失败，Worker 会尝试把对象移回隔离区，避免数据库和对象公开状态不一致；
5. 下载只允许读取 `clean/`，感染或未完成扫描的文件不会进入公开下载路径；
6. 用户删除后对象先移动到不可公开的 `deleted/` 前缀，默认保留 7 天；清理 Worker 到期后再永久删除对象与数据库记录；
7. 多 Worker 通过数据库领取与租约机制避免重复处理，并能够恢复异常退出后遗留的扫描任务。

## 文件系统模式

单机部署可以配置：

```env
FILE_STORAGE_DRIVER=filesystem
FILE_STORAGE_PATH=/var/lib/gojet/files
```

目录必须只允许 GoJet 服务用户写入，不应直接暴露为 Nginx 静态目录。公开文件下载始终通过受控的文件分享接口完成权限、密码、状态和扫描结果检查。

## S3 兼容对象存储

配置：

```env
FILE_STORAGE_DRIVER=s3
S3_ENDPOINT=s3.example.com
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=gojet-files
S3_REGION=...
S3_SECURE=true
```

Bucket 必须由部署流程预先创建。服务启动时会验证对象存储配置和 Bucket 是否真实可用；S3 配置失败时不得静默回退到本地磁盘。

## ClamAV

文件扫描由 File Worker 调用 ClamAV。未完成扫描的文件保持不可公开状态；检测到风险的文件留在隔离区，并记录扫描结果供客户中心和管理后台查看。

原生服务器常见 clamd Socket：

```text
unix:///run/clamav/clamd.ctl
```

正式安装验收应使用 EICAR 测试文件验证“上传 → 扫描 → 隔离 → 禁止下载”的完整链路，并在测试结束后删除测试对象。