# GoJet GeoIP data

GoJet production installation uses a real City MMDB instead of leaving the runtime GeoIP path empty.

## Canonical database path

Both supported production modes use the same repository-side database:

- database: `deploy/data/geoip/city.mmdb`
- source/license record: `deploy/data/geoip/source.txt`

`services/redirectengine` reads the database through `GEOIP_MMDB`. Native/systemd resolves that variable to the absolute `deploy/data/geoip/city.mmdb` path; Docker mounts `deploy/data/geoip` read-only at `/data/geoip` and sets `GEOIP_MMDB=/data/geoip/city.mmdb`.

## Native / aaPanel

`install.sh` invokes `scripts/installgeoip.sh` before the browser installer is exposed. The helper downloads the newest available monthly **DB-IP City Lite** MMDB (falling back to the previous two monthly releases when necessary), validates the gzip and MMDB metadata, and writes the canonical files above.

The systemd service refuses to start without a non-empty `city.mmdb`. This is intentional: a successful fresh installation must not silently fall back to country/region/city = unknown simply because the database was never installed.

## Docker

`./install.sh --docker` / `scripts/installdocker.sh` invokes the same `scripts/installgeoip.sh` helper before building and starting the production stack. The redirect container mounts the GeoIP directory read-only and reads `/data/geoip/city.mmdb`, so Docker and Native cannot silently drift to different filenames.

A failed GeoIP download or validation stops installation before GoJet is reported as ready. This keeps fresh-install analytics deterministic instead of producing an apparently healthy deployment with all local GeoIP results missing.

DB-IP City Lite is distributed under the Creative Commons Attribution 4.0 International license. Its web-use attribution requirement is satisfied on GoJet analytics surfaces with a link to DB-IP.

To refresh the database later:

```bash
sudo rm -f deploy/data/geoip/city.mmdb
sudo bash scripts/installgeoip.sh
```

Then restart the relevant runtime:

```bash
# Native / aaPanel
sudo systemctl restart gojet@redirectengine.service

# Docker
sudo docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml restart redirectengine
```

## Other compatible MMDB data

Operators may replace `deploy/data/geoip/city.mmdb` with another MaxMind DB compatible **City** database. GoJet reads country ISO code, first subdivision name/code, and city name. When localized names are available it prefers `zh-CN`, then `zh`, then `en`.

## CSV fallback

The existing `country.csv` fallback remains supported. Accepted row formats are:

```text
CIDR,country[,region[,city]]
start_ip,end_ip,country[,region[,city]]
```

Examples:

```text
203.0.113.0/24,SG,Central Singapore,Singapore
2001:db8::,2001:db8::ffff,AU,Queensland,Brisbane
```

Country values must be two-letter ISO-style codes. CSV is intended as a lightweight/operator-managed fallback; use a City MMDB for production-scale country/region/city enrichment.

## Resolution order

GoJet first accepts trusted location headers from the CDN/reverse proxy, then fills missing country/region/city values from the local MMDB, then from `country.csv`. The actual IP used for MMDB lookup and visitor hashing follows the same trusted client-IP chain behind the local reverse proxy: `CF-Connecting-IP`, `True-Client-IP`, then `X-Real-IP`.

If a provider header does not include region/city, the local City MMDB supplies those fields. GoJet never invents a location when neither trusted provider data nor local database data can identify it.
