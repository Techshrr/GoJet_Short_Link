# GoJet 生产部署、升级与回滚

正式交付使用 `gojet-<版本>-linux-production.zip`，而不是 Git 工作区或开发 Compose。发行包根目录的
`INSTALL.md` 是完整安装手册，包含 Docker 安装、密钥生成、DNS/TLS、首次验收、升级、回滚与故障
排查步骤。

## 生成并校验生产发行包

```sh
go test -race ./...
go vet ./...
make build
./scripts/package-release.sh v4.0.0-rc.1
sha256sum -c dist/gojet-v4.0.0-rc.1-linux-production.zip.sha256
./scripts/verify-release.sh dist/gojet-v4.0.0-rc.1-linux-production.zip
```

生产 ZIP 只保留构建运行必需的 `app/`、`frontend/`、`services/`、迁移、生产 Compose、Nginx、
部署脚本和运维文档。它明确排除 `.git`、Node 依赖、Playwright、测试、测试报告、开发 Compose、
Makefile、日志和真实环境文件，并包含内部 `MANIFEST.sha256`。

## Linux 主机安装摘要

```sh
sha256sum -c gojet-v4.0.0-rc.1-linux-production.zip.sha256
unzip gojet-v4.0.0-rc.1-linux-production.zip
cd gojet-v4.0.0-rc.1-linux-production
cp deploy/.env.production.example deploy/.env.production
chmod 600 deploy/.env.production
# 按 INSTALL.md 生成并填写全部独立密钥
./install.sh
```

安装器拒绝占位值、弱长度/复用密码、错误的 32 字节设置密钥、不一致的日志 Token、非 HTTPS
公开地址和不完整的 S3 设置；随后执行 `docker compose config`、镜像构建、MySQL/Redis 启动、迁移
登记、全部服务启动和真实健康检查。

已有系统 Nginx 的主机应在环境文件设置 `NGINX_MODE=host`，然后运行
`sudo ./install-host-nginx.sh`。该模式不会启动容器 Nginx，只将两个 HTTP 服务绑定到回环地址，
生成带当前绝对安装路径的系统 Nginx 配置，执行 `nginx -t` 成功后才 reload。不能直接把容器版
`gojet.conf` 复制到主机，因为其中的 Docker DNS 服务名在主机网络不可解析。

## 升级与回滚

不要覆盖旧发行目录。解压新 ZIP、复制旧 `deploy/.env.production` 后在新目录执行
`./upgrade.sh`。脚本先生成 MySQL 一致性压缩备份，再迁移和健康检查。

回滚时进入保留的旧发行目录，复制同一生产环境文件，并执行：

```sh
./rollback.sh ../新版本目录/backups/gojet-<UTC时间>.sql.gz
```

详细命令、安全警告、volume 快照和排障步骤均在发行包 `INSTALL.md`。严禁使用
`docker compose down -v`，否则会删除持久化数据卷。
