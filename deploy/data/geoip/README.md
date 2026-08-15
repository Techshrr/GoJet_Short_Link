# GoJet GeoIP data

GoJet does not bundle a third-party IP geolocation database. The redirect engine can enrich analytics from CDN location headers, but reliable country/region/city data for direct traffic requires a local database.

## Recommended MMDB

Place a MaxMind DB compatible **City** database at:

- Native/aaPanel: `deploy/data/geoip/GeoLite2-City.mmdb`
- Docker Compose host: `deploy/data/geoip/GeoLite2-City.mmdb` (mounted read-only as `/data/geoip/GeoLite2-City.mmdb`)

GeoLite2 City, GeoIP2 City, or another compatible `.mmdb` database may be used. GoJet reads only country ISO code, first subdivision name/code, and city name. When localized names are available it prefers `zh-CN`, then `zh`, then `en`.

After adding or replacing the MMDB, restart the redirect engine so the memory-mapped database is reopened:

```bash
systemctl restart gojet@redirectengine.service
```

or for Compose:

```bash
docker compose -f deploy/compose.production.yaml restart redirectengine
```

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

For each field GoJet keeps an already supplied CDN/provider value and fills only missing values from the local MMDB, then from `country.csv`. This matters for Cloudflare, where `CF-IPCountry` commonly supplies the country but not region/city.

If no provider location headers and no usable local database are available, analytics intentionally stores the missing geography as unknown rather than inventing a location.
