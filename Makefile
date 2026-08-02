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

build:
	go build -o /tmp/gojet-redirect ./services/redirect-engine/cmd/server
	go build -o /tmp/gojet-analytics-worker ./services/analytics-worker/cmd/worker
	go build -o /tmp/gojet-analytics-reconciler ./services/analytics-reconciler/cmd/reconciler
	go build -o /tmp/gojet-platform ./services/platform-api/cmd/server
	go build -o /tmp/gojet-mail-worker ./services/platform-api/cmd/mail-worker

package:
	./scripts/package-release.sh
