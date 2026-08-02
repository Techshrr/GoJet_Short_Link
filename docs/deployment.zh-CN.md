# GoJet 生产部署、升级与回滚

## 前置条件

- Linux 主机、Docker Engine 24+ 与 Compose v2；
- 至少 2 CPU、4 GB RAM 和持久化磁盘；
- 指向主机的正式域名；
- 外部 TLS 终止（推荐 Cloudflare）或在 Nginx 前配置证书管理器。

## 全新安装

```sh
cp deploy/.env.production.example deploy/.env.production
# 替换文件内全部密码与 VISITOR_HASH_KEY
./install.sh
```

安装器会拒绝占位密码，限制环境文件权限，构建镜像，启动 Redis/MySQL，逐个登记并执行数据库
迁移，启动服务，并等待 `/health` 真实通过。生产环境文件不得提交 Git。

## 升级

```sh
git fetch --all --prune
git checkout <verified-release>
./upgrade.sh
```

升级前会使用一致性快照备份 MySQL，并保存当前 Git revision。迁移通过 `schema_migrations`
登记，只执行尚未应用的文件。升级完成的唯一成功条件是 HTTP 健康检查通过。

## 回滚

```sh
./rollback.sh <previous-git-revision> backups/gojet-<timestamp>.sql.gz
```

回滚会检验 revision 和备份文件、重建旧镜像、恢复数据库并重新执行健康检查。Redis AOF 数据
保留在独立 volume；在破坏性发布前还应对 Redis volume 做基础设施快照。

## TLS

示例 Nginx 只监听内部/源站 HTTP。公网部署必须使用 Cloudflare Full (strict)、负载均衡器证书，
或用 Certbot/Caddy 提供 TLS。不得在未配置 HTTPS 的情况下启用账号、管理后台或 SMTP 密钥设置。
