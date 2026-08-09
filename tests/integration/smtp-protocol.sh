#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
go test -race -tags integration_smtp ./app/mail
