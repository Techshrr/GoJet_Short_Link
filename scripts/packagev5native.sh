#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
OUT=${GOJET_NATIVE_OUT:-$ROOT/dist/native}
NAME=gojet-v5-native-linux-amd64
STAGE="$OUT/stage/$NAME"
ARCHIVE="$OUT/$NAME.tar.gz"
SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH:-$(git -C "$ROOT" show -s --format=%ct HEAD)}
SHA=$(git -C "$ROOT" rev-parse HEAD)
VERSION=$(cat "$ROOT/VERSION" 2>/dev/null || printf '5.0.0-%s\n' "${SHA:0:12}")

need(){ command -v "$1" >/dev/null 2>&1 || { echo "missing packaging tool: $1" >&2; exit 1; }; }
for x in git go pnpm python3 tar sha256sum; do need "$x"; done

rm -rf "$OUT/stage"
mkdir -p "$STAGE/bin" "$STAGE/public" "$STAGE/scripts" "$STAGE/deploy" "$OUT"

printf '==> build V5 frontend\n'
pnpm --dir "$ROOT/frontend" build

printf '==> build eight linux/amd64 Go runtimes\n'
export CGO_ENABLED=0 GOOS=linux GOARCH=amd64
build(){ go build -trimpath -ldflags "-s -w -X main.version=$VERSION" -o "$STAGE/bin/$1" "$2"; }
build redirectengine "$ROOT/services/redirectengine/cmd/server"
build platformapi "$ROOT/services/platformapi/cmd/server"
build analyticsworker "$ROOT/services/analyticsworker/cmd/worker"
build analyticsreconciler "$ROOT/services/analyticsreconciler/cmd/reconciler"
build fileworker "$ROOT/services/platformapi/cmd/fileworker"
build mailworker "$ROOT/services/platformapi/cmd/mailworker"
build operationsmonitor "$ROOT/services/platformapi/cmd/operationsmonitor"
build logreceiver "$ROOT/services/logreceiver/cmd/server"

printf '==> stage static surfaces and Native runtime assets\n'
cp -a "$ROOT/frontend/apps/site/dist/." "$STAGE/public/"
mkdir -p "$STAGE/public/docs" "$STAGE/public/app" "$STAGE/public/admin" "$STAGE/public/install"
cp -a "$ROOT/frontend/apps/docs/dist/." "$STAGE/public/docs/"
cp -a "$ROOT/frontend/apps/workspace/dist/." "$STAGE/public/app/"
cp -a "$ROOT/frontend/apps/admin/dist/." "$STAGE/public/admin/"
cp -a "$ROOT/public/install/." "$STAGE/public/install/"
cp -a "$ROOT/installer" "$STAGE/installer"
cp -a "$ROOT/database" "$STAGE/database"
cp -a "$ROOT/deploy/native" "$STAGE/deploy/native"
cp -a "$ROOT/deploy/nginx" "$STAGE/deploy/nginx"
cp -a "$ROOT/scripts/runmigrations.sh" "$STAGE/scripts/"
cp -a "$ROOT/scripts/nativeinstallerapply.sh" "$STAGE/scripts/"
cp -a "$ROOT/scripts/nativeinstallerrun.sh" "$STAGE/scripts/"
cp -a "$ROOT/scripts/installgeoip.sh" "$STAGE/scripts/"
cp -a "$ROOT/install.sh" "$STAGE/install.sh"
printf '%s\n' "$VERSION" > "$STAGE/VERSION"
chmod 0755 "$STAGE/install.sh" "$STAGE/scripts/"*.sh "$STAGE/bin/"*

printf '==> normalize staged installer to frozen V5 Native architecture\n'
python3 - "$STAGE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1])

# Native artifact must not expose the historical Docker bootstrap.
p=s/'install.sh'
t=p.read_text()
t=t.replace('''\nif [[ "${1:-}" == "--docker" ]]; then\n  exec "$ROOT/scripts/installdocker.sh"\nfi\n''','\n')
needle='command -v gzip >/dev/null 2>&1 || die "需要 gzip"\n'
font='''command -v gzip >/dev/null 2>&1 || die "需要 gzip"\nPDF_FONT=/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc\nif [[ ! -f "$PDF_FONT" ]]; then\n  command -v apt-get >/dev/null 2>&1 || die "缺少 Noto CJK 字体且系统没有 apt-get"\n  DEBIAN_FRONTEND=noninteractive apt-get update\n  DEBIAN_FRONTEND=noninteractive apt-get install -y fonts-noto-cjk\nfi\n[[ -f "$PDF_FONT" ]] || die "缺少 PDF 中文字体：$PDF_FONT"\n'''
if needle not in t: raise SystemExit('install.sh font insertion anchor missing')
t=t.replace(needle,font)
p.write_text(t)

# Staged Native installer requires authenticated Redis and validates V5 hashed Admin assets.
p=s/'scripts/nativeinstallerapply.sh'
t=p.read_text()
t=t.replace('for key in MYSQL_PORT MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD REDIS_PORT PUBLIC_BASE_URL ADMIN_EMAIL ADMIN_PASSWORD; do',
            'for key in MYSQL_PORT MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD REDIS_PORT REDIS_PASSWORD PUBLIC_BASE_URL ADMIN_EMAIL ADMIN_PASSWORD; do')
t=t.replace('redis_password=${cfg[REDIS_PASSWORD]-}', 'redis_password=${cfg[REDIS_PASSWORD]}')
t=t.replace("[[ ${#mysql_password} -le 512 && ${#redis_password} -le 512 ]] || fail '数据库或 Redis 密码过长'",
            "[[ ${#mysql_password} -le 512 && ${#redis_password} -ge 12 && ${#redis_password} -le 512 ]] || fail 'Redis 密码长度必须为 12-512 位，数据库密码不得超过 512 位'")
t=t.replace('''redis_args=(-h 127.0.0.1 -p "${cfg[REDIS_PORT]}")\nif [[ -n "${cfg[REDIS_PASSWORD]:-}" ]]; then\n  redis_args+=(-a "${cfg[REDIS_PASSWORD]}")\nfi\n''',
            '''redis_args=(-h 127.0.0.1 -p "${cfg[REDIS_PORT]}" -a "${cfg[REDIS_PASSWORD]}")\n''')
t=t.replace('printf \'REDIS_PASSWORD=%s\\n\' "$(envq "${cfg[REDIS_PASSWORD]:-}")"',
            'printf \'REDIS_PASSWORD=%s\\n\' "$(envq "${cfg[REDIS_PASSWORD]}")"')
old='''"${CURL_LOCAL[@]}" "$PUBLIC_ORIGIN/admin/" | grep -Fq 'method="post" action="/api/admin/auth/login"' || fail '管理员登录页安全回退验证失败；已恢复安装前 rewrite'\n"${CURL_LOCAL[@]}" "$PUBLIC_ORIGIN/admin/styles.css" | grep -Fq ':root{' || fail '管理员后台 CSS 无法通过当前宝塔/Nginx 路由读取；已恢复安装前 rewrite'\n"${CURL_LOCAL[@]}" "$PUBLIC_ORIGIN/admin/app.js" | grep -Fq 'loginForm' || fail '管理员后台 JavaScript 无法通过当前宝塔/Nginx 路由读取；已恢复安装前 rewrite'\n'''
new='''admin_html=$(mktemp)\n"${CURL_LOCAL[@]}" "$PUBLIC_ORIGIN/admin/" > "$admin_html" || fail '管理员 V5 SPA 入口无法读取；已恢复安装前 rewrite'\ngrep -Fq '<div id="root"></div>' "$admin_html" || fail '管理员 V5 SPA root mount 缺失；已恢复安装前 rewrite'\nadmin_asset=$(grep -oE '/admin/assets/[^" ]+\\.js' "$admin_html" | head -n1 || true)\n[[ -n "$admin_asset" ]] || fail '管理员 V5 hashed JavaScript 资产引用缺失；已恢复安装前 rewrite'\n"${CURL_LOCAL[@]}" "$PUBLIC_ORIGIN$admin_asset" >/dev/null || fail '管理员 V5 hashed JavaScript 无法读取；已恢复安装前 rewrite'\nrm -f "$admin_html"\n'''
if old not in t: raise SystemExit('legacy Admin verification block missing')
t=t.replace(old,new)
p.write_text(t)

font_old='__GOJET_ROOT__/resources/fonts/NotoSansSCRegular.ttf'
font_new='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
for rel in ('deploy/native/gojet@.service','deploy/native/gojet.env.example'):
    p=s/rel
    if p.exists(): p.write_text(p.read_text().replace(font_old,font_new))
p=s/'deploy/native/gojet.env.example'
t=p.read_text().replace('REDIS_PASSWORD=\n','REDIS_PASSWORD=replace-with-a-strong-redis-password\n')
p.write_text(t)
PY

printf '==> write exact-version manifest and CycloneDX SBOM\n'
python3 - "$ROOT" "$STAGE" "$SHA" "$VERSION" <<'PY'
from pathlib import Path
import json, subprocess, sys, hashlib
root,stage,sha,version=map(str,sys.argv[1:])
stage=Path(stage)
bins=['redirectengine','platformapi','analyticsworker','analyticsreconciler','fileworker','mailworker','operationsmonitor','logreceiver']
manifest={
  'schema':'gojet-v5-native-version-manifest-v1',
  'product':'GoJet','phase':'P21','gate':'G11','version':version,'git_sha':sha,
  'platform':{'os':'linux','arch':'amd64','runtime':'go+systemd','web':'nginx+php-8.3','database':'mysql-8.x','cache':'redis-authenticated'},
  'binaries':bins,
  'surfaces':{'website_auth':'public/','docs':'public/docs/','workspace':'public/app/','admin':'public/admin/','installer':'public/install/'},
  'fresh_install_claimed':False
}
(stage/'VERSION-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
mods=subprocess.check_output(['go','list','-m','-f','{{.Path}}|{{.Version}}','all'],cwd=root,text=True).splitlines()
components=[]
for line in mods:
    path,_,ver=line.partition('|')
    components.append({'type':'library','name':path,'version':ver or 'workspace','purl':f'pkg:golang/{path}@{ver}' if ver else None})
for p in sorted((Path(root)/'frontend').glob('**/package.json')):
    if 'node_modules' in p.parts: continue
    try: d=json.loads(p.read_text())
    except Exception: continue
    if d.get('name'): components.append({'type':'application' if '/apps/' in str(p).replace('\\','/') else 'library','name':d['name'],'version':d.get('version','workspace')})
for c in components:
    if c.get('purl') is None: c.pop('purl',None)
sbom={'bomFormat':'CycloneDX','specVersion':'1.5','serialNumber':f'urn:uuid:{sha[:8]}-{sha[8:12]}-{sha[12:16]}-{sha[16:20]}-{sha[20:32]}','version':1,
      'metadata':{'component':{'type':'application','name':'GoJet V5 Native','version':version},'properties':[{'name':'gojet.git.sha','value':sha},{'name':'gojet.phase','value':'P21'},{'name':'gojet.gate','value':'G11'}]},
      'components':components}
(stage/'SBOM.cdx.json').write_text(json.dumps(sbom,ensure_ascii=False,indent=2)+'\n')
PY

printf '==> checksum staged payload\n'
(
  cd "$STAGE"
  find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256
)

printf '==> create deterministic archive\n'
rm -f "$ARCHIVE" "$ARCHIVE.sha256"
tar --sort=name --mtime="@$SOURCE_DATE_EPOCH" --owner=0 --group=0 --numeric-owner -C "$OUT/stage" -czf "$ARCHIVE" "$NAME"
(cd "$OUT" && sha256sum "$(basename "$ARCHIVE")" > "$(basename "$ARCHIVE").sha256")
printf '%s\n' "$ARCHIVE"
