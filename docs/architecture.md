# GoJet V4 architecture baseline

The repository is divided into three product surfaces and a high-performance
redirect data plane. `frontend/marketing-site`, `frontend/user-console`, and
`frontend/admin-console` deliberately remain separate so that admin privileges
cannot leak into the customer navigation. Business policy belongs in `app`,
while deployable data-plane services belong in `services`.

## Redirect and analytics contract

1. `GET /{code}` resolves an active link from Redis.
2. One Redis Lua transaction increments the real-time counter, updates the
   HyperLogLog unique-visitor estimate, and appends the complete event to
   `gojet:analytics:events`.
3. A redirect is returned only after Redis acknowledges the durable stream
   append. An unavailable analytics store produces a recoverable 503 rather
   than silently losing the visit or displaying a false zero.
4. The analytics worker (next delivery slice) consumes the stream with a
   consumer group, writes batches to MySQL, acknowledges successful rows, and
   reconciles MySQL aggregates against the Redis counters.

`GET /api/links/{id}/stats` reads live Redis values, so a delayed worker never
makes a visited link appear unused. `GET /api/system/analytics` exposes the
stream length for operations monitoring and backlog alerts.

## Privacy and source semantics

Visitor identifiers are SHA-256 hashes of a secret key, client address, and
user agent; raw IP addresses never enter the event stream. An empty Referer is
classified as `direct`. A present, parseable host is `referer`; malformed or
hostless values are `unknown`. Bots are retained as separately marked events,
allowing dashboards to exclude them without destroying audit data.

## Local verification

```sh
cp .env.example .env
# Replace VISITOR_HASH_KEY, then:
docker compose up --build
curl -X POST localhost:8080/api/links -H 'content-type: application/json' \
  -d '{"id":"1","code":"demo","destination":"https://example.com","status_code":302}'
curl -i localhost:8080/demo
curl localhost:8080/api/links/1/stats
```
