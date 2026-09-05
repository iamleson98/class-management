#!/usr/bin/env python3
"""Generate LMS dashboards batch C: business, calls/rtcd + alert provisioning."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dash_lib import (  # noqa: E402
    reset_ids, timeseries, stat, row, dashboard, save, target,
)

ALERTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "provisioning", "alerting")


def business():
    reset_ids()
    panels = []
    panels.append(stat(
        "Payments / day",
        [target("sum(increase(mattermost_lms_payments_created_total[24h]))", "", instant=True)],
        x=0, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "Homework submissions / day",
        [target("sum(increase(mattermost_lms_homework_submissions_total[24h]))", "", instant=True)],
        x=4, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "New students / day",
        [target("sum(increase(mattermost_lms_students_created_total[24h]))", "", instant=True)],
        x=8, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "Class media entries (total)",
        [target("mattermost_lms_class_media_created_total - mattermost_lms_class_media_deleted_total", "", instant=True)],
        x=12, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "Logins / day",
        [target("sum(increase(mattermost_login_logins_total[24h]))", "", instant=True)],
        x=16, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "Failed logins / day",
        [target("sum(increase(mattermost_login_logins_fail_total[24h]))", "", instant=True)],
        x=20, y=0, w=4, h=4, unit="short", thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "green", "value": None},
                {"color": "orange", "value": 20},
                {"color": "red", "value": 100},
            ],
        }, legend_fmt="",
    ))
    panels.append(timeseries(
        "Payments / day by method",
        [target(
            "sum by (method) (increase(mattermost_lms_payments_created_total[1d]))",
            "{{method}}")],
        x=0, y=4, w=8, h=8, unit="short", fill=20,
    ))
    panels.append(timeseries(
        "Homework submissions by kind (new vs updated)",
        [target(
            "sum by (kind) (increase(mattermost_lms_homework_submissions_total[1d]))",
            "{{kind}}")],
        x=8, y=4, w=8, h=8, unit="short", fill=20, stack=True,
    ))
    panels.append(timeseries(
        "Logins vs failed logins (per hour)",
        [
            target("sum(increase(mattermost_login_logins_total[1h]))", "success"),
            target("sum(increase(mattermost_login_logins_fail_total[1h]))", "failed"),
        ],
        x=16, y=4, w=8, h=8, unit="short", fill=20,
    ))
    panels.append(row("Activity", y=12))
    panels.append(timeseries(
        "New students (per day)",
        [target("sum(increase(mattermost_lms_students_created_total[1d]))", "students")],
        x=0, y=13, w=8, h=7, unit="short", fill=20,
    ))
    panels.append(timeseries(
        "Class media created vs deleted (per day)",
        [
            target("sum(increase(mattermost_lms_class_media_created_total[1d]))", "created"),
            target("sum(increase(mattermost_lms_class_media_deleted_total[1d]))", "deleted"),
        ],
        x=8, y=13, w=8, h=7, unit="short", fill=20,
    ))
    panels.append(timeseries(
        "Posts / messages (per hour)",
        [target("sum(increase(mattermost_post_total[1h]))", "posts")],
        x=16, y=13, w=8, h=7, unit="short", fill=20,
    ))
    panels.append(row("Notifications", y=20))
    panels.append(timeseries(
        "Emails sent (per hour)",
        [target("sum(increase(mattermost_post_emails_sent_total[1h]))", "emails")],
        x=0, y=21, w=8, h=7, unit="short", fill=20,
    ))
    panels.append(timeseries(
        "Pushes sent (per hour)",
        [target("sum(increase(mattermost_post_pushes_sent_total[1h]))", "pushes")],
        x=8, y=21, w=8, h=7, unit="short", fill=20,
    ))
    panels.append(timeseries(
        "Notification failures by reason (per hour)",
        [target(
            "sum by (reason) (increase(mattermost_notifications_error[1h]))", "{{reason}}")],
        x=16, y=21, w=8, h=7, unit="short", fill=20,
    ))
    return dashboard("LMS Business", "lms-business", panels,
                     tags=["lms", "business"], refresh="1m", time_from="now-7d")


def calls_rtcd():
    reset_ids()
    panels = []
    panels.append(stat(
        "Active call sessions",
        [target("sum(rtcd_rtc_sessions_total)", "", instant=True)],
        x=0, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "RTP tracks",
        [target("sum(rtcd_rtc_rtp_tracks_total)", "", instant=True)],
        x=4, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "rtcd errors / min",
        [target("sum(rate(rtcd_rtc_errors_total[5m])) * 60 or vector(0)", "", instant=True)],
        x=8, y=0, w=4, h=4, unit="short", decimals=1, thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "green", "value": None},
                {"color": "orange", "value": 1},
                {"color": "red", "value": 10},
            ],
        }, legend_fmt="",
    ))
    panels.append(stat(
        "WS connections (rtcd)",
        [target("sum(rtcd_ws_connections_total)", "", instant=True)],
        x=12, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "rtcd goroutines",
        [target('go_goroutines{job="lms-rtcd"}', "", instant=True)],
        x=16, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "rtcd memory",
        [target('process_resident_memory_bytes{job="lms-rtcd"}', "", instant=True)],
        x=20, y=0, w=4, h=4, unit="bytes", legend_fmt="",
    ))
    panels.append(timeseries(
        "Active call sessions (by group)",
        [target("rtcd_rtc_sessions_total", "{{groupID}}")],
        x=0, y=4, w=8, h=8, unit="short", stack=True, fill=25,
    ))
    panels.append(timeseries(
        "RTP tracks by direction & type",
        [target("sum by (direction, type) (rtcd_rtc_rtp_tracks_total)", "{{direction}} {{type}}")],
        x=8, y=4, w=8, h=8, unit="short", stack=True, fill=25,
    ))
    panels.append(timeseries(
        "WS messages / s (by direction)",
        [target("sum by (direction) (rate(rtcd_ws_messages_total[5m]))", "{{direction}}")],
        x=16, y=4, w=8, h=8, unit="ops",
    ))
    panels.append(timeseries(
        "Connection states / min",
        [target(
            "sum by (type) (rate(rtcd_rtc_conn_states_total[5m])) * 60", "{{type}}")],
        x=0, y=12, w=8, h=8, unit="short",
    ))
    panels.append(timeseries(
        "rtcd errors / min (by type)",
        [target(
            "sum by (type) (rate(rtcd_rtc_errors_total[5m])) * 60", "{{type}}")],
        x=8, y=12, w=8, h=8, unit="short",
    ))
    panels.append(timeseries(
        "Client RTT p95",
        [target(
            "histogram_quantile(0.95, sum by (le) (rate(rtcd_rtc_client_rtt_bucket[5m])))", "p95 rtt")],
        x=16, y=12, w=8, h=8, unit="s",
    ))
    panels.append(row("Media quality (reported by clients)", y=20))
    panels.append(timeseries(
        "Packet loss p95",
        [target(
            "histogram_quantile(0.95, sum by (le) (rate(rtcd_rtc_client_loss_rate_bucket[5m])))", "p95 loss")],
        x=0, y=21, w=8, h=7, unit="percent",
    ))
    panels.append(timeseries(
        "Jitter p95",
        [target(
            "histogram_quantile(0.95, sum by (le) (rate(rtcd_rtc_client_jitter_bucket[5m])))", "p95 jitter")],
        x=8, y=21, w=8, h=7, unit="s",
    ))
    panels.append(timeseries(
        "Connection duration p95",
        [target(
            "histogram_quantile(0.95, sum by (le) (rate(rtcd_rtc_connection_time_bucket[5m])))", "p95 duration")],
        x=16, y=21, w=8, h=7, unit="s",
    ))
    return dashboard("LMS Calls (rtcd)", "lms-calls", panels,
                     tags=["lms", "calls"], refresh="30s")


# ─────────────────────────── Alert provisioning ───────────────────────────

def alert_rule(uid, title, expr, threshold, operator, for_dur, severity,
               summary, description=""):
    """Build one Grafana-managed alert rule (threshold on last value)."""
    return {
        "uid": uid,
        "title": title,
        "condition": "B",
        "data": [
            {
                "refId": "A",
                "queryType": "",
                "relativeTimeRange": {"from": 300, "to": 0},
                "datasourceUid": "prometheus",
                "model": {
                    "datasource": {"type": "prometheus", "uid": "prometheus"},
                    "editorMode": "code",
                    "expr": expr,
                    "instant": True,
                    "intervalMs": 1000,
                    "legendFormat": "__auto",
                    "maxDataPoints": 43200,
                    "range": False,
                    "refId": "A",
                },
            },
            {
                "refId": "B",
                "queryType": "",
                "relativeTimeRange": {"from": 0, "to": 0},
                "datasourceUid": "__expr__",
                "model": {
                    "conditions": [
                        {
                            "evaluator": {"params": [threshold], "operator": operator},
                            "operator": {"type": "and"},
                            "query": {"params": ["B"]},
                            "reducer": {"params": [], "type": "last"},
                            "type": "query",
                        }
                    ],
                    "datasource": {"type": "__expr__", "uid": "__expr__"},
                    "expression": "A",
                    "intervalMs": 1000,
                    "maxDataPoints": 43200,
                    "reducer": "last",
                    "refId": "B",
                    "settings": {"mode": "dropnn"},
                    "type": "threshold",
                },
            },
        ],
        "dashboardUid": None,
        "panelId": None,
        "noDataState": "OK",
        "execErrState": "Error",
        "for": for_dur,
        "annotations": {
            "summary": summary,
            "description": description,
        },
        "labels": {"severity": severity},
        "isPaused": False,
    }


def write_alerts():
    import os
    import yaml
    os.makedirs(ALERTS_DIR, exist_ok=True)
    rules = [
        alert_rule(
            "lms-scrape-down", "LMS server metrics scrape is down",
            'up{job="lms-server"}', 1, "neq", "2m", "critical",
            "Prometheus cannot scrape the LMS server metrics endpoint (:8067).",
            "The backend may be down, or the metrics listener died. Check "
            "`docker service logs lms-server` / container health.",
        ),
        alert_rule(
            "lms-site-down", "LMS site is unreachable (probe failed)",
            'probe_success{job="blackbox-api"}', 1, "neq", "3m", "critical",
            "The blackbox probe to /api/v4/system/ping failed for 3 minutes.",
            "End users are likely unable to use the system. Check the server, "
            "Traefik/Caddy routing and the frontend container.",
        ),
        alert_rule(
            "lms-high-error-rate", "High HTTP error rate",
            "sum(rate(mattermost_http_errors_total[5m])) / sum(rate(mattermost_http_requests_total[5m]))",
            0.05, "gt", "5m", "critical",
            "More than 5% of HTTP requests are errors.",
            "Look at the LMS HTTP API dashboard — top failing endpoints — and "
            "the server logs.",
        ),
        alert_rule(
            "lms-high-latency", "API latency p95 above 2s",
            "histogram_quantile(0.95, sum by (le) (rate(mattermost_api_time_bucket[5m])))",
            2, "gt", "10m", "warning",
            "API p95 latency stayed above 2 seconds for 10 minutes.",
            "Check the database dashboard (slow store methods) and host load.",
        ),
        alert_rule(
            "lms-upload-failures", "File uploads are failing",
            "sum(rate(mattermost_file_upload_failures_total[5m]))", 0, "gt", "5m",
            "warning",
            "File uploads (chat attachments / class media) are failing.",
            "Check the Uploads & Storage dashboard: S3/RustFS errors and the "
            "failing stage. This is the flow that previously broke image "
            "rendering.",
        ),
        alert_rule(
            "lms-db-conn-saturated", "DB connections saturated",
            'mattermost_db_in_use_connections{db_name="master"} / mattermost_db_open_connections{db_name="master"}',
            0.95, "gt", "5m", "critical",
            "95% of open database connections are in use for 5 minutes.",
            "Check for long-running queries on the database dashboard and "
            "consider raising MaxIdleConns / adding read replicas.",
        ),
        alert_rule(
            "lms-disk-almost-full", "Host disk almost full",
            '100 * (1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}))',
            85, "gt", "10m", "warning",
            "Root filesystem usage is above 85%.",
            "Prune Docker images/volumes (the promdata volume grows with "
            "retention), or expand the disk.",
        ),
        alert_rule(
            "lms-memory-pressure", "Host memory pressure",
            "100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))",
            90, "gt", "5m", "warning",
            "Memory usage is above 90% for 5 minutes.",
            "Check per-container memory on the Containers dashboard; consider "
            "raising container limits or the host plan.",
        ),
        alert_rule(
            "lms-ws-drop", "WebSocket connections dropped to zero",
            "sum(mattermost_http_websockets_total)", 1, "lt", "10m", "warning",
            "No WebSocket connections at all for 10 minutes while the server is up.",
            "Chat may be disconnected for all users. Check the frontend proxy "
            "path for /api/v4/websocket.",
        ),
    ]
    doc = {
        "apiVersion": 1,
        "groups": [
            {
                "orgId": 1,
                "name": "LMS",
                "folder": "LMS Alerts",
                "interval": "1m",
                "rules": rules,
            }
        ],
    }
    path = os.path.join(ALERTS_DIR, "alerts.yml")
    with open(path, "w") as f:
        yaml.safe_dump(doc, f, sort_keys=False)
    print(f"wrote {path} ({len(rules)} alert rules)")


if __name__ == "__main__":
    save(business(), "lms-business.json")
    save(calls_rtcd(), "lms-calls.json")
    write_alerts()
