.PHONY: test test-go test-browser test-integration build package

test: test-go test-browser

test-go:
	go test -race ./...
	go vet ./...

test-browser:
	npm ci --ignore-scripts
	npx playwright install chromium
	npm audit --audit-level=high
	npm run test:e2e

test-integration:
	./tests/integration/redis-analytics.sh
	./tests/integration/mysql-platform.sh
	./tests/integration/smtp-protocol.sh
	./tests/integration/clamav-eicar.sh
	./tests/integration/minio-storage.sh
	./tests/integration/full-stack-analytics.sh
	./tests/integration/file-worker-scale.sh
	./tests/integration/log-receiver.sh
	./tests/integration/release-package.sh
	./tests/integration/nginx-host.sh

build:
	go build -o /tmp/gojet-redirect ./services/redirect-engine/cmd/server
	go build -o /tmp/gojet-analytics-worker ./services/analytics-worker/cmd/worker
	go build -o /tmp/gojet-analytics-reconciler ./services/analytics-reconciler/cmd/reconciler
	go build -o /tmp/gojet-platform ./services/platform-api/cmd/server
	go build -o /tmp/gojet-mail-worker ./services/platform-api/cmd/mail-worker
	go build -o /tmp/gojet-file-worker ./services/platform-api/cmd/file-worker
	go build -o /tmp/gojet-operations-monitor ./services/platform-api/cmd/operations-monitor
	go build -o /tmp/gojet-log-receiver ./services/log-receiver/cmd/server

package:
	./scripts/package-release.sh
