# V4 Upgrade, Backup and Recovery

## 升级前

1. 读取发布说明和迁移文件。
2. 执行 `sudo bash scripts/backup.sh`。
3. 把数据库、私有存储、`.env` 和 Go spool 备份复制到应用服务器以外的位置。
4. 在测试环境恢复一次，确认备份可用。

## 传统部署更新

把新生产包解压到新 release 目录，复制旧 `.env`，再原子切换 `current` 软链接。单目录更新可执行：

```bash
sudo APP_DIR=/var/www/gojet/current bash scripts/update.sh
```

生产包已包含 `vendor/` 和前端资源；默认不会联网运行 Composer 或 npm。只有源码构建时设置 `BUILD_ASSETS=1`。

升级后执行：

```bash
sudo -u www-data php artisan gojet:analytics:reconcile --dry-run
sudo -u www-data php scripts/assert-v4-upgrade.php
curl -fsS http://127.0.0.1:8081/healthz
```

## Docker 更新

```bash
docker compose build --pull
docker compose up -d
docker compose exec --user www-data app php artisan migrate --force
docker compose exec --user www-data app php artisan optimize
docker compose exec --user www-data app php artisan queue:restart
```

不要删除 `gojet_redirect_spool` 卷。

## 恢复

1. 停止 Nginx、Go redirector、Worker 和 Scheduler。
2. 恢复 `.env`、MySQL 和 `storage/app`。
3. 恢复 spool 目录；事件 UUID 会避免重复落库。
4. 执行迁移、优化和 `gojet:analytics:reconcile`。
5. 启动服务并检查 `/up` 与 Go `/healthz`。
6. 访问一条样例短链并核对统计。

Redis 不是数据库备份。V4 的未投递 Go 事件保存在持久化 spool，因此该目录也必须进入备份。
