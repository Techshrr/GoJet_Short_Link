.PHONY: test test-go test-browser test-integration build package

test: test-go test-browser

test-go:
	go test -race ./...
	go vet ./...

test-browser:
	bash scripts/npmci.sh --ignore-scripts
	npx playwright install chromium
	npm audit --audit-level=high
	npm run test:e2e

test-integration:
	./tests/integration/redisanalytics.sh
	./tests/integration/mysqlplatform.sh
	./tests/integration/smtpprotocol.sh
	./tests/integration/clamaveicar.sh
	./tests/integration/miniostorage.sh
	./tests/integration/fullstackanalytics.sh
	./tests/integration/fileworkerscale.sh
	./tests/integration/logreceiver.sh
	./tests/integration/releasepackage.sh
	./tests/integration/nginxhost.sh

build:
	go build -o /tmp/gojet-redirect ./services/redirectengine/cmd/server
	go build -o /tmp/gojet-analyticsworker ./services/analyticsworker/cmd/worker
	go build -o /tmp/gojet-analyticsreconciler ./services/analyticsreconciler/cmd/reconciler
	go build -o /tmp/gojet-platform ./services/platformapi/cmd/server
	go build -o /tmp/gojet-mailworker ./services/platformapi/cmd/mailworker
	go build -o /tmp/gojet-fileworker ./services/platformapi/cmd/fileworker
	go build -o /tmp/gojet-operationsmonitor ./services/platformapi/cmd/operationsmonitor
	go build -o /tmp/gojet-logreceiver ./services/logreceiver/cmd/server

package:
	./scripts/packagerelease.sh
