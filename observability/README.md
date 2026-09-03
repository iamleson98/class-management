# LMS Observability Stack

Production-style monitoring for the LMS platform: **Prometheus** (scrape +
TSDB, 10-day retention), **Grafana** (provisioned dashboards + alerts), and
five metric exporters. Everything is declarative and checked into the repo —
`docker compose up -d` (or a Swarm stack deploy) yields a fully working
observability plane with zero clicking in the Grafana UI.

```
                       ┌─────────────────────────────────────────────┐
                       │                  GRAFANA                    │
                       │  9 provisioned dashboards + 9 alert rules   │
                       └────────────────────┬────────────────────────┘
                                            │ PromQL (uid: prometheus)
                       ┌────────────────────┴────────────────────────┐
                       │               PROMETHEUS :9090              │
                       │  15s scrape • 10d retention • rules engine  │
                       └───┬──────┬──────┬──────┬──────┬──────┬──────┘
                           │      │      │      │      │      │
        lms-server ────────┘      │      │      │      │      └── self
        :8067 (mattermost_*,      │      │      │
        go_*, process_*)           │      │      └── blackbox-exporter :9115
                                   │      │          (probes api ping + frontend)
        lms-rtcd :8045 ───────────┘      └── node-exporter :9100 (host)
        (rtcd_rtc_*, rtcd_ws_*)               cadvisor :8080 (per container)
                                             postgres-exporter :9187 (pg internals)
```

## Components

| File / dir | What it is |
|---|---|
| `prometheus.yml` | Scrape config for docker-compose (service-name targets) |
| `prometheus.dev.yml` | Dev config when the Go server runs on the host |
| `prometheus-rules.yml` | Recording rules (precomputed rates/quantiles for dashboards) |
| `grafana/provisioning/datasources/` | Prometheus datasource (uid pinned to `prometheus`) |
| `grafana/provisioning/dashboards/` | Dashboard provider (loads every JSON in `grafana/dashboards/`) |
| `grafana/provisioning/alerting/alerts.yml` | 9 Grafana-managed alert rules (folder "LMS Alerts") |
| `grafana/dashboards/*.json` | The 9 dashboards (see below) |
| `../deploy/swarm/configs/prometheus.yml` | Swarm variant — uses `tasks.*` DNS for multi-replica discovery |

Services added to `docker-compose.yml` and `deploy/swarm/stack.yml`:
`node-exporter` (host metrics, global mode in Swarm = one per node),
`cadvisor` (container metrics, global), `postgres-exporter` (DB internals),
`blackbox-exporter` (synthetic probes). Prometheus retention is
**10 days** (`--storage.tsdb.retention.time=10d`).

## Dashboards

| Dashboard | Covers |
|---|---|
| **LMS Overview** | Availability probe, req/s, error rate, p95 latency, WS connections, posts, uploads, active users, goroutines/memory, emails/pushes |
| **LMS System Resources** | Host CPU/load/memory/disk/network/TCP + per-process CPU/RSS/fd for server & rtcd — the "load & resource" view |
| **LMS Containers** | cAdvisor per-container CPU, memory, network, throttling, restarts (container filter variable) |
| **LMS HTTP API** | Calls by status/method/origin, p50/p95/p99, top-15 slowest endpoints, etag hit ratio |
| **LMS Chat & WebSocket** | Posts, broadcasts by event, WS connections & events, reconnects, cache hit/miss, store latency |
| **LMS Uploads & Storage** | Upload rate/duration/failures/bytes, every S3(RustFS) request by operation & code, class media |
| **LMS Database** | Go sql.DB connections/waits, store method p95, pg cache hit ratio, dead tuples, table sizes, xid |
| **LMS Business** | Payments by method, homework submissions, students, class media, logins, notifications |
| **LMS Calls (rtcd)** | Call sessions, RTP tracks, conn states, client RTT/loss/jitter, rtcd process health |

Dashboards auto-reload every 30s (`updateIntervalSeconds`) — edit the JSON in
the repo and the change lands within 30 seconds.

## Metrics added to the backend (sensitive places)

The upstream Mattermost core already exports ~100 metrics
(`mattermost_api_time`, `mattermost_http_*`, `mattermost_websocket_*`,
`mattermost_cache_*`, `mattermost_db_*`, `go_*`, `process_*`, ...). This fork
adds coverage for the business-critical / historically fragile paths:

| Metric | Why |
|---|---|
| `mattermost_file_upload_duration_seconds{success}` | Full upload lifecycle (chat attachments, class media) — the flow that previously broke image rendering |
| `mattermost_file_upload_bytes_total` | Upload volume |
| `mattermost_file_upload_failures_total{stage}` | Failures split by stage (`upload_file`, `upload_session`) |
| `mattermost_filestore_s3_request_duration_seconds{operation,code}` | EVERY S3/RustFS HTTP round trip, measured at the transport layer — GET/PUT/HEAD/DELETE/multipart all included, no per-method instrumentation needed |
| `mattermost_lms_payments_created_total{method}` | Money flow |
| `mattermost_lms_homework_submissions_total{kind}` | Coursework (new vs updated) |
| `mattermost_lms_class_media_created_total` / `_deleted_total` | Media library activity |
| `mattermost_lms_students_created_total` | Student onboarding |

Instrumentation lives in `server/enterprise/metrics/lms_metrics.go`,
`server/platform/shared/filestore/metrics.go` (S3 observer hook) and the call
sites in `server/channels/app/{upload,file,lms/*}.go`.

## Alerts (folder "LMS Alerts")

| Alert | Fires when | Severity |
|---|---|---|
| LMS server metrics scrape is down | `up{job="lms-server"} == 0` for 2m | critical |
| LMS site is unreachable (probe failed) | blackbox probe fails 3m | critical |
| High HTTP error rate | >5% errors for 5m | critical |
| API latency p95 above 2s | p95 > 2s for 10m | warning |
| File uploads are failing | any upload failure for 5m | warning |
| DB connections saturated | in-use/open > 95% for 5m | critical |
| Host disk almost full | root fs > 85% for 10m | warning |
| Host memory pressure | mem > 90% for 5m | warning |
| WebSocket connections dropped to zero | no WS conns 10m while up | warning |

Alerts are visible in Grafana (Alerting → Alert rules). To deliver them,
configure a contact point: SMTP (Grafana admin UI → Alerting → Contact
points), or point the notification policy at email/Slack/Telegram after
provisioning. The rules themselves need no changes.

## Quick ops

```bash
# Bring the whole stack up
docker compose up -d

# Grafana  → http://localhost:3001 (admin / GRAFANA_ADMIN_PASSWORD)
# Prometheus → http://localhost:9090

# Reload prometheus.yml / rules without restarting
curl -X POST http://localhost:9090/-/reload

# Check scrape targets are all green
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health}'

# TSDB disk usage
curl -s http://localhost:9090/api/v1/query?query=prometheus_tsdb_storage_blocks_bytes | jq .
```

## Cost & resource optimization — research notes

Sizing context: a 1000-user LMS on a single Contabo host produces roughly
60–120 active time series per backend replica (plus ~5k series from
node/cadvisor/postgres exporters — dominated by cadvisor's per-container
series). That is small; the stack below is already trimmed, but there is
room to go leaner. The options, ranked by effort/benefit:

### 1. Swap Prometheus → VictoriaMetrics (biggest win, low effort)

[VictoriaMetrics](https://victoriametrics.com) (the TSDB is Go, the hot paths
are heavily optimized; the ecosystem tooling includes Rust components) is a
drop-in replacement for single-node Prometheus:

- **~1.7x less RAM** and **5–10x better compression** than Prometheus at the
  same load (multiple published benchmarks; users report 10–20x total
  infrastructure savings once Thanos/Cortex-style fan-out is factored in —
  irrelevant here, but the per-node saving is real).
- Single binary with a **built-in Prometheus-compatible scraper** — it reads
  the exact `prometheus.yml` used today, so vmagent is not even needed.
- Grafana works unchanged (Prometheus datasource type against
  `http://victoriametrics:8428`), including recording-rule-free operation —
  VM's `MetricsQL` and query caching make the recording rules optional.
- Retention: `-retentionPeriod=10d` (it honors the same requirement).

Migration sketch (docker-compose):

```yaml
  victoriametrics:
    image: victoriametrics/victoria-metrics:v1.115.0   # pin current stable
    command:
      - -promscrape.config=/etc/prometheus/prometheus.yml
      - -retentionPeriod=10d
      - -storageDataPath=/victoria-metrics-data
    volumes:
      - ./observability/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - vmdata:/victoria-metrics-data
```

then point the Grafana datasource at `http://victoriametrics:8428` and remove
the `prometheus` service. The alert rules must move from Grafana-managed
(they query the `prometheus` datasource) to the same datasource pointing at
VM — everything else (dashboards, exporters) is untouched.

**Do it when**: you observe the Prometheus container above ~400MB RSS, or
you extend retention beyond 30d, or you add more high-cardinality metrics
(per-class chat traffic etc.). At the current scale the win is a few hundred
MB of RAM — real but not urgent.

### 2. Right-size what runs today (zero effort, already applied)

- Grafana: `GF_ANALYTICS_*` phone-home disabled, log level `warn`,
  512MB limit in Swarm.
- cAdvisor `--housekeeping_interval=30s` (default 15s doubles its CPU) and
  `--docker_only`.
- node-exporter: filesystem collector excludes `/dev|/proc|/sys|/var/lib/docker`.
- Prometheus: 15s scrape, 10d retention, recording rules for the hot
  queries. `--web.enable-lifecycle` for zero-downtime config reloads.
- ~1.1GB of RAM total for the whole observability plane on one host
  (prom 512M + grafana 512M capped + exporters ~400M combined, usually
  far below their caps).

### 3. Cardinality guardrails (free, prevents future cost)

The expensive label in this stack is `mattermost_api_time{handler,...}` — it
is fine at current traffic, but if you later expose per-route metrics from
the frontend or per-class counters, keep unique label values bounded (≤
a few thousand). The dashboards deliberately aggregate before displaying.

### 4. Grafana alternatives (researched, not recommended yet)

- **Perses** (CNCF sandbox, by ex-Grafana/Red Hat engineers):
  dashboards-as-code, notably lighter than Grafana — but dashboard-only
  (no alerting), a smaller plugin ecosystem, and our alert rules are the
  bigger value here.
- Grafana stays the pragmatic choice: alerting + provisioning + ecosystem.
  If it ever feels heavy, `GF_LOG_LEVEL=warn` + 512MB cap is usually enough;
  a dashboard-only Perses sidecar is a viable future split.

### 5. RustFS-native telemetry (optional)

RustFS (pinned 1.0.0-rc.4) exports metrics via OpenTelemetry rather than a
Prometheus scrape endpoint. Storage visibility is already covered by the
server-side `mattermost_filestore_s3_*` metrics (latency + error codes for
every request, measured at the HTTP transport). If you want RustFS internals
(its own disk/IO stats), either enable Prometheus' OTLP receiver
(`--web.enable-otlp-receiver`) and point RustFS's OTLP export at it, or
enable the commented scrape job when a future RustFS release exposes the
MinIO-compatible `/minio/v2/metrics/cluster` endpoint.

### Rough disk math for retention

Prometheus uses ~1–2 bytes/sample post-compression. At ~7k series × 15s
scrape = ~470 samples/s ≈ 40M samples/day ≈ 60–90MB/day → **10 days fits
in under 1GB** (plus WAL head ~256MB transient). The `promdata` volume on a
Contabo disk is negligible; VictoriaMetrics would cut the same to
~10–20MB/day.
