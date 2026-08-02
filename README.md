# GoJet V4

GoJet is being rebuilt as a production short-link platform. The repository now
contains the redirect and analytics data plane, Platform API, workers, three
frontend surfaces and deployment tooling. It is not yet a completed production
release; the evidence-based completion matrix is maintained in
[`docs/v4-status.zh-CN.md`](docs/v4-status.zh-CN.md).

## Development

```sh
go test -race ./...
go vet ./...
npm run test:e2e
```

Configuration is documented in [`.env.example`](.env.example). No dashboard
uses seeded or demonstration metrics: API statistics are derived from recorded
redirect events.

Architecture guarantees are documented in [`docs/architecture.md`](docs/architecture.md).
The phased acceptance gates and owner-supplied production inputs remain tracked
in [`docs/v4-delivery-plan.zh-CN.md`](docs/v4-delivery-plan.zh-CN.md).
