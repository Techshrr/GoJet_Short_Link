#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
for command in mariadbd minio curl python3; do command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }; done
tmp="$(mktemp -d)"; mysql_port=33082; minio_port=19004; clam_port=13312
cleanup(){ for pid in ${worker_pids:-} "${clam_pid:-}" "${minio_pid:-}" "${mysql_pid:-}"; do test -z "$pid" || kill "$pid" 2>/dev/null || true; done; rm -rf "$tmp"; }
trap cleanup EXIT
mariadb-install-db --no-defaults --datadir="$tmp/mysql" --auth-root-authentication-method=normal --skip-test-db >/dev/null
mariadbd --no-defaults --datadir="$tmp/mysql" --socket="$tmp/mysql.sock" --port="$mysql_port" --bind-address=127.0.0.1 --pid-file="$tmp/mysql.pid" --log-error="$tmp/mysql.log" --skip-name-resolve --user="$(id -un)" & mysql_pid=$!
for _ in $(seq 1 60); do mariadb-admin --no-defaults --socket="$tmp/mysql.sock" ping --silent >/dev/null 2>&1 && break; sleep 1; done
mariadb --no-defaults --socket="$tmp/mysql.sock" -uroot -e "CREATE DATABASE gojet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'gojet'@'127.0.0.1' IDENTIFIED BY 'integration'; GRANT ALL ON gojet.* TO 'gojet'@'127.0.0.1';"
for migration in database/migrations/*.sql; do mariadb --no-defaults --socket="$tmp/mysql.sock" -uroot gojet <"$migration"; done
export MINIO_ROOT_USER=gojet-scale MINIO_ROOT_PASSWORD=gojet-scale-secret
minio server "$tmp/minio" --address "127.0.0.1:$minio_port" --console-address "127.0.0.1:19005" >"$tmp/minio.log" 2>&1 & minio_pid=$!
for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:$minio_port/minio/health/ready" >/dev/null 2>&1 && break; sleep 1; done
cat >"$tmp/clam.py" <<'PY'
import socket,struct,threading
s=socket.socket();s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.bind(('127.0.0.1',13312));s.listen()
def scan(c):
 try:
  command=b''
  while not command.endswith(b'\0'): command+=c.recv(1)
  while True:
   size=struct.unpack('>I',c.recv(4))[0]
   if size==0: break
   remaining=size
   while remaining: remaining-=len(c.recv(remaining))
  c.sendall(b'stream: OK\0')
 finally: c.close()
while True: threading.Thread(target=scan,args=(s.accept()[0],),daemon=True).start()
PY
python3 "$tmp/clam.py" & clam_pid=$!
export MYSQL_DSN="gojet:integration@tcp(127.0.0.1:${mysql_port})/gojet?parseTime=true&charset=utf8mb4" FILE_STORAGE_DRIVER=s3 S3_ENDPOINT="127.0.0.1:${minio_port}" S3_ACCESS_KEY="$MINIO_ROOT_USER" S3_SECRET_KEY="$MINIO_ROOT_PASSWORD" S3_BUCKET=gojet-scale S3_REGION=us-east-1 S3_SECURE=false S3_SCAN_TEMP_PATH="$tmp/scans" CLAMAV_ADDRESS="127.0.0.1:${clam_port}"
cat >"$tmp/seed.go" <<'GO'
package main
import("bytes";"context";"database/sql";"fmt";"os";"github.com/minio/minio-go/v7";"github.com/minio/minio-go/v7/pkg/credentials";_ "github.com/go-sql-driver/mysql")
func main(){ctx:=context.Background();c,e:=minio.New(os.Getenv("S3_ENDPOINT"),&minio.Options{Creds:credentials.NewStaticV4(os.Getenv("S3_ACCESS_KEY"),os.Getenv("S3_SECRET_KEY"),""),Secure:false});if e!=nil{panic(e)};if e=c.MakeBucket(ctx,os.Getenv("S3_BUCKET"),minio.MakeBucketOptions{Region:"us-east-1"});e!=nil{panic(e)};db,e:=sql.Open("mysql",os.Getenv("MYSQL_DSN"));if e!=nil{panic(e)};defer db.Close();must:=func(q string,a ...any){if _,e=db.Exec(q,a...);e!=nil{panic(e)}};must("INSERT INTO users(id,email,password_hash,display_name) VALUES(1,'scale@gojet.test','x','Scale')");must("INSERT INTO workspaces(id,name,workspace_type,owner_id) VALUES(1,'Scale','personal',1)");must("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(1,1,'owner')");for i:=1;i<=25;i++{name:=fmt.Sprintf("scale-%02d",i);payload:=[]byte("safe-"+name);if _,e=c.PutObject(ctx,os.Getenv("S3_BUCKET"),"quarantine/"+name,bytes.NewReader(payload),int64(len(payload)),minio.PutObjectOptions{ContentType:"text/plain"});e!=nil{panic(e)};must("INSERT INTO file_shares(id,workspace_id,created_by,slug,original_name,storage_name,mime_type,size_bytes) VALUES(?,1,1,?,?,?,'text/plain',?)",i,name,name+".txt",name,len(payload))};must("UPDATE file_shares SET scan_status='scanning',scan_attempts=1,next_scan_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=1")}
GO
go run "$tmp/seed.go"
go build -o "$tmp/fileworker" ./services/platformapi/cmd/fileworker
started="$(date +%s)"; worker_pids=""
for i in 1 2 3; do "$tmp/fileworker" >"$tmp/worker-$i.log" 2>&1 & worker_pids="$worker_pids $!"; done
for _ in $(seq 1 60); do clean="$(mariadb --no-defaults --socket="$tmp/mysql.sock" -N -uroot gojet -e "SELECT COUNT(*) FROM file_shares WHERE scan_status='clean' AND status='active'")"; test "$clean" = 25 && break; sleep 1; done
test "$clean" = 25; elapsed=$(( $(date +%s) - started )); test "$elapsed" -le 30
test "$(mariadb --no-defaults --socket="$tmp/mysql.sock" -N -uroot gojet -e "SELECT COUNT(*) FROM file_shares WHERE scan_attempts=1")" = 24
test "$(mariadb --no-defaults --socket="$tmp/mysql.sock" -N -uroot gojet -e "SELECT scan_attempts FROM file_shares WHERE id=1")" = 2
cat >"$tmp/retention.go" <<'GO'
package main
import("context";"database/sql";"fmt";"os";"time";"github.com/Techshrr/GoJet_Short_Link/app/objectstorage";"github.com/Techshrr/GoJet_Short_Link/app/resources";"github.com/Techshrr/GoJet_Short_Link/app/workspace";_ "github.com/go-sql-driver/mysql")
func main(){ctx:=context.Background();db,e:=sql.Open("mysql",os.Getenv("MYSQL_DSN"));if e!=nil{panic(e)};defer db.Close();store,e:=objectstorage.FromEnvironment(ctx,"");if e!=nil{panic(e)};svc:=resources.New(db,workspace.New(db),"","","http://localhost").WithFileStore(store);if e=svc.DeleteFile(ctx,1,1,2,0*time.Second);e!=nil{panic(e)};if _,e=svc.OpenDownload(ctx,"scale-02");e==nil{panic("deleted file remained downloadable")};n,e:=svc.PurgeDeletedFiles(ctx,10);if e!=nil||n!=1{panic(fmt.Sprintf("purged=%d err=%v",n,e))}}
GO
go run "$tmp/retention.go"
test "$(mariadb --no-defaults --socket="$tmp/mysql.sock" -N -uroot gojet -e "SELECT COUNT(*) FROM file_shares WHERE id=2")" = 0
echo "file worker scale acceptance passed: workers=3 files=25 elapsed=${elapsed}s recovered_leases=1 purged=1"
