# Docker Compose 安装

## 1. 准备环境

安装 Docker Engine 与 Compose 插件。复制环境模板：

```bash
cp .env.docker.example .env
```

必须修改：

- `APP_URL`、`GOJET_DEFAULT_HOST`
- MySQL root、应用用户密码
- Redis 密码
- `APP_KEY`
- `GOJET_IP_HASH_KEY`
- `GOJET_REDIRECT_INTERNAL_TOKEN`
- 管理员邮箱、后台路径和 SMTP

生成密钥示例：

```bash
sed -i "s|^APP_KEY=.*|APP_KEY=base64:$(openssl rand -base64 32)|" .env
sed -i "s|^GOJET_IP_HASH_KEY=.*|GOJET_IP_HASH_KEY=$(openssl rand -hex 32)|" .env
sed -i "s|^GOJET_REDIRECT_INTERNAL_TOKEN=.*|GOJET_REDIRECT_INTERNAL_TOKEN=$(openssl rand -hex 32)|" .env
chmod 600 .env
```

## 2. 构建与启动

```bash
docker compose config
docker compose up -d --build
docker compose exec --user www-data app php artisan migrate --force
docker compose exec --user www-data app php artisan storage:link
docker compose exec --user www-data app php artisan optimize
docker compose exec --user www-data app php artisan gojet:check
```

Compose 会启动：

- `app`：PHP-FPM 控制面
- `worker`：默认队列
- `scheduler`：Laravel 调度器
- `redirector`：Go 跳转面
- `nginx`
- `mysql`
- `redis`

`gojet_redirect_spool` 是必须保留的持久化卷。

## 3. 验证

```bash
docker compose ps
docker compose logs --tail=100 app worker scheduler redirector nginx
docker compose exec redirector wget -qO- http://127.0.0.1:8081/healthz
docker compose exec --user www-data app php artisan gojet:analytics:reconcile --dry-run
curl -fsS "http://127.0.0.1:${GOJET_HTTP_PORT:-8080}/up"
```

健康接口应返回 `status`、Redis 状态和 `pending_events`。待处理事件不应长期增长。

## 4. HTTPS

Compose Nginx 默认监听宿主机 `8080`。在前面部署 Cloudflare、Caddy、Traefik 或宿主机 Nginx。必须把真实客户端 IP、协议和 Host 转发给 GoJet。

## 5. 更新

```bash
docker compose build --pull
docker compose up -d
docker compose exec --user www-data app php artisan migrate --force
docker compose exec --user www-data app php artisan optimize
docker compose exec --user www-data app php artisan queue:restart
docker compose exec --user www-data app php artisan gojet:check
```

更新前先备份数据库、私有存储和 redirect spool。
