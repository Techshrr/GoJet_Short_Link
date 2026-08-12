#!/usr/bin/env bash
set -euo pipefail

BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$BASE$p"; }
expect(){ local want=$1 raw=$2 label=$3; local got body; got=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$got" == "$want" ]]||{ echo "FAIL $label expected $want got $got" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }

suffix="$(date +%s)-$RANDOM"
registration=$(expect 201 "$(req POST /api/auth/register "{\"email\":\"analytics-$suffix@example.test\",\"display_name\":\"零访问分析验收\",\"password\":\"AnalyticsZeroAcceptance!2026\"}")" register)
token=$(printf '%s' "$registration"|field "['token']")
workspaces=$(expect 200 "$(req GET /api/workspaces '' "$token")" workspaces)
wid=$(printf '%s' "$workspaces"|python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')
created=$(expect 201 "$(req POST "/api/workspaces/$wid/links" '{"destination":"https://example.com/zero","title":"零访问短链","redirect_status":302,"one_time":false}' "$token")" create-link)
lid=$(printf '%s' "$created"|field "['id']")

from=$(date -u -d '30 days ago' +%F)
to=$(date -u -d 'tomorrow' +%F)
analytics=$(expect 200 "$(req GET "/api/workspaces/$wid/links/$lid/analytics?from=$from&to=$to" '' "$token")" zero-analytics)
printf '%s' "$analytics" | python3 - <<'PY'
import json,sys
data=json.load(sys.stdin)
for key in ('clicks','unique_visitors','bot_visits'):
    if data.get(key) != 0:
        raise SystemExit(f'{key} expected 0, got {data.get(key)!r}')
for key in ('sources','countries','regions','cities','devices','browsers','operating_systems','languages','utm_sources','destinations','recent'):
    if data.get(key) != []:
        raise SystemExit(f'{key} expected empty array, got {data.get(key)!r}')
print('zero visit analytics payload: PASS')
PY

printf 'GoJet zero visit analytics acceptance: PASS (link %s)\n' "$lid"
