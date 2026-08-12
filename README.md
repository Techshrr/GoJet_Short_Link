# GoJet

GoJet is a self-hosted short-link platform with public pages, a customer console,
an administrator console, redirect and analytics services, billing, file and text
sharing, QR codes, custom domains, support tickets, mail delivery and deployment
tooling.

The repository is currently in release-candidate validation. Repository CI is
required evidence, but it does not replace the final owner-operated installation
and production-channel acceptance.

## Acceptance gates

The active gates cover:

- full-stack P0 API and lifecycle acceptance on fresh MySQL and Redis services;
- installer and deployment source validation;
- authentication-policy acceptance;
- browser product-surface acceptance through Nginx;
- real invoice PDF rendering and visual contrast checks;
- production archive construction, checksum/evidence verification, and a fresh
  installation candidate using the exact packaged eight-service runtime.

The remaining production handoff is documented and validated outside CI where
real infrastructure or credentials are required, including the owner-operated
aaPanel fresh installation, ClamAV EICAR verification, eight-service restart
verification, and real payment-channel acceptance.

## Development

```sh
go test -race ./...
go vet ./...
bash scripts/npmci.sh
npm run test:e2e
```

Infrastructure-backed integration tests additionally require the services named
by the individual scripts under `tests/integration/`.

## Documentation

- Architecture: [`docs/architecture.md`](docs/architecture.md)
- Deployment: [`docs/deployment.zhCN.md`](docs/deployment.zhCN.md)
- Fresh-install guide: [`deploy/INSTALL.zhCN.md`](deploy/INSTALL.zhCN.md)
- Full-stack acceptance: [`docs/fullstackacceptance.zhCN.md`](docs/fullstackacceptance.zhCN.md)
- Integration acceptance: [`docs/integrationacceptance.zhCN.md`](docs/integrationacceptance.zhCN.md)
- Mail center: [`docs/mailcenter.zhCN.md`](docs/mailcenter.zhCN.md)
- Object storage: [`docs/objectstorage.zhCN.md`](docs/objectstorage.zhCN.md)

Configuration examples are provided in [`.env.example`](.env.example) and
`deploy/.env.production.example`.
