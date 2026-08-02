# GoJet V4

GoJet is being rebuilt as a production short-link platform. The first completed
slice is the redirect/real-time analytics foundation; see
[`docs/architecture.md`](docs/architecture.md) for its guarantees and local
runbook.

## Development

```sh
go test -race ./...
go vet ./...
```

Configuration is documented in [`.env.example`](.env.example). No dashboard
uses seeded or demonstration metrics: API statistics are derived from recorded
redirect events.

The complete phased scope, acceptance gates, and inputs that must come from the
project owner are tracked in
[`docs/v4-delivery-plan.zh-CN.md`](docs/v4-delivery-plan.zh-CN.md). The current
redirect slice must not be mistaken for completion of the full V4 product.
