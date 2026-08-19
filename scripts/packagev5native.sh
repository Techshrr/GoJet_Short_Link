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
for x in git go pnpm python3 tar sha256sum cmp; do need "$x"; done

rm -rf "$OUT/stage"
mkdir -p "$STAGE/bin" "$STAGE/public" "$STAGE/scripts" "$STAGE/deploy" "$STAGE/resources/fonts" "$OUT"

printf '==> prepare pinned static Unicode PDF font\n'
bash "$ROOT/scripts/preparepdffonts.sh"

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
cp -a "$ROOT/resources/fonts/." "$STAGE/resources/fonts/"
cp -a "$ROOT/scripts/runmigrations.sh" "$STAGE/scripts/"
cp -a "$ROOT/scripts/nativeinstallerapply.sh" "$STAGE/scripts/"
cp -a "$ROOT/scripts/nativeinstallerrun.sh" "$STAGE/scripts/"
cp -a "$ROOT/scripts/installgeoip.sh" "$STAGE/scripts/"
cp -a "$ROOT/install.sh" "$STAGE/install.sh"
printf '%s\n' "$VERSION" > "$STAGE/VERSION"
chmod 0755 "$STAGE/install.sh" "$STAGE/scripts/"*.sh "$STAGE/bin/"*

printf '==> enforce source/package installer byte identity\n'
for rel in installer/index.php scripts/nativeinstallerapply.sh scripts/nativeinstallerrun.sh deploy/native/gojet.env.example install.sh; do
  cmp -s "$ROOT/$rel" "$STAGE/$rel" || {
    echo "P21 source/package integrity failure: $rel" >&2
    exit 1
  }
done

printf '==> write exact-version manifest and CycloneDX SBOM\n'
python3 - "$ROOT" "$STAGE" "$SHA" "$VERSION" <<'PY'
from pathlib import Path
import json, subprocess, sys
root,stage,sha,version=map(str,sys.argv[1:])
stage=Path(stage)
bins=['redirectengine','platformapi','analyticsworker','analyticsreconciler','fileworker','mailworker','operationsmonitor','logreceiver']
manifest={
  'schema':'gojet-v5-native-version-manifest-v1',
  'product':'GoJet','phase':'P21','gate':'G11','version':version,'git_sha':sha,
  'platform':{'os':'linux','arch':'amd64','runtime':'go+systemd','web':'nginx+php-8.3','database':'mysql-8.x','cache':'redis-local-noauth-or-authenticated'},
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
