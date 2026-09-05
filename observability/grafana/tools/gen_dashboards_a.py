#!/usr/bin/env python3
"""Generate LMS dashboards batch A: overview, system resources, containers."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dash_lib import (  # noqa: E402
    reset_ids, timeseries, stat, gauge, row, dashboard, save, var_query,
    target,
)


def overview():
    reset_ids()
    panels = []
    # Row 1 — at a glance
    panels.append(stat(
        "Backend availability (probe)",
        [target('probe_success{job="blackbox-api"}', "api", instant=True)],
        x=0, y=0, w=3, h=4, thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "red", "value": None},
                {"color": "green", "value": 1},
            ],
        }, legend_fmt="",
    ))
    panels.append(stat(
        "API requests / s",
        [target("sum(rate(mattermost_http_requests_total[1m]))", "req/s", instant=True)],
        x=3, y=0, w=3, h=4, unit="reqps", legend_fmt="",
    ))
    panels.append(stat(
        "HTTP errors / s",
        [target("sum(rate(mattermost_http_errors_total[5m]))", "err/s", instant=True)],
        x=6, y=0, w=3, h=4, unit="reqps", thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "green", "value": None},
                {"color": "orange", "value": 0.5},
                {"color": "red", "value": 2},
            ],
        }, legend_fmt="",
    ))
    panels.append(stat(
        "WebSocket connections",
        [target('sum(mattermost_http_websockets_total)', "ws", instant=True)],
        x=9, y=0, w=3, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "Posts / min",
        [target("sum(rate(mattermost_post_total[5m])) * 60", "posts/min", instant=True)],
        x=12, y=0, w=3, h=4, unit="short", decimals=1, legend_fmt="",
    ))
    panels.append(stat(
        "File uploads / min",
        [target('sum(rate(mattermost_file_upload_duration_seconds_count{success="true"}[10m])) * 60', "uploads/min", instant=True)],
        x=15, y=0, w=3, h=4, unit="short", decimals=1, legend_fmt="",
    ))
    panels.append(stat(
        "Active users (DB)",
        [target("mattermost_db_active_users", "users", instant=True)],
        x=18, y=0, w=3, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "Server uptime",
        [target('time() - process_start_time_seconds{job="lms-server"}', "uptime", instant=True)],
        x=21, y=0, w=3, h=4, unit="s", color_mode="value", legend_fmt="",
    ))
    # Row 2 — traffic & errors
    panels.append(timeseries(
        "HTTP requests / errors per second",
        [
            target("sum(rate(mattermost_http_requests_total[1m]))", "requests"),
            target("sum(rate(mattermost_http_errors_total[1m]))", "errors"),
        ],
        x=0, y=4, w=12, h=8, unit="reqps",
    ))
    panels.append(timeseries(
        "API latency p50 / p95 (all endpoints)",
        [
            target(
                "histogram_quantile(0.50, sum by (le) (rate(mattermost_api_time_bucket[5m])))",
                "p50"),
            target(
                "histogram_quantile(0.95, sum by (le) (rate(mattermost_api_time_bucket[5m])))",
                "p95"),
        ],
        x=12, y=4, w=12, h=8, unit="s",
        thresholds={"mode": "absolute", "steps": [
            {"color": "green", "value": None},
            {"color": "orange", "value": 1},
            {"color": "red", "value": 2},
        ]},
    ))
    # Row 3 — chat activity & auth
    panels.append(timeseries(
        "Posts created / min",
        [target("sum(rate(mattermost_post_total[1m])) * 60", "posts")],
        x=0, y=12, w=8, h=7, unit="short", fill=15,
    ))
    panels.append(timeseries(
        "Logins (success / failed) per min",
        [
            target("sum(rate(mattermost_login_logins_total[5m])) * 60", "success"),
            target("sum(rate(mattermost_login_logins_fail_total[5m])) * 60", "failed"),
        ],
        x=8, y=12, w=8, h=7, unit="short", fill=15,
    ))
    panels.append(timeseries(
        "WebSocket connections by client origin",
        [target('mattermost_http_websockets_total', "{{origin_client}}")],
        x=16, y=12, w=8, h=7, unit="short", stack=True, fill=25,
    ))
    # Row 4 — process health
    panels.append(timeseries(
        "Server goroutines & GC pause",
        [
            target('go_goroutines{job="lms-server"}', "goroutines"),
            target('rate(go_gc_duration_seconds_sum{job="lms-server"}[5m])', "gc s/s"),
        ],
        x=0, y=19, w=8, h=7, unit="short",
    ))
    panels.append(timeseries(
        "Server memory (resident / heap)",
        [
            target('process_resident_memory_bytes{job="lms-server"}', "resident"),
            target('go_memstats_heap_inuse_bytes{job="lms-server"}', "heap in use"),
        ],
        x=8, y=19, w=8, h=7, unit="bytes",
    ))
    panels.append(timeseries(
        "Emails & pushes sent / min",
        [
            target("sum(rate(mattermost_post_emails_sent_total[5m])) * 60", "emails"),
            target("sum(rate(mattermost_post_pushes_sent_total[5m])) * 60", "pushes"),
        ],
        x=16, y=19, w=8, h=7, unit="short", fill=15,
    ))
    return dashboard(
        "LMS Overview", "lms-overview", panels,
        tags=["lms", "overview"], refresh="30s",
    )


def system_resources():
    reset_ids()
    panels = []
    # Row 1 — headline stats
    panels.append(gauge(
        "CPU usage (all cores)",
        [target("100 * (1 - avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[1m])))", "cpu")],
        x=0, y=0, w=5, h=5, thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "green", "value": None},
                {"color": "orange", "value": 70},
                {"color": "red", "value": 90},
            ],
        },
    ))
    panels.append(gauge(
        "Memory usage",
        [target("100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))", "mem")],
        x=5, y=0, w=5, h=5, thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "green", "value": None},
                {"color": "orange", "value": 80},
                {"color": "red", "value": 92},
            ],
        },
    ))
    panels.append(gauge(
        "Root disk usage",
        [target('100 * (1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}))', "disk")],
        x=10, y=0, w=5, h=5, thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "green", "value": None},
                {"color": "orange", "value": 80},
                {"color": "red", "value": 90},
            ],
        },
    ))
    panels.append(stat(
        "Load (1m / 5m / 15m)",
        [
            target("node_load1", "1m"),
            target("node_load5", "5m"),
            target("node_load15", "15m"),
        ],
        x=15, y=0, w=4, h=5, unit="short", decimals=2,
    ))
    panels.append(stat(
        "CPU cores",
        [target('count(count(node_cpu_seconds_total{mode="idle"}) by (cpu))', "cores", instant=True)],
        x=19, y=0, w=5, h=5, unit="short", color_mode="value", legend_fmt="",
    ))
    # Row 2 — CPU & load over time
    panels.append(timeseries(
        "CPU usage % (by mode)",
        [target('100 * rate(node_cpu_seconds_total{mode!="idle"}[1m])', "{{cpu}} {{mode}}")],
        x=0, y=5, w=12, h=8, unit="percent", stack=True, fill=30,
    ))
    panels.append(timeseries(
        "System load",
        [
            target("node_load1", "load 1m"),
            target("node_load5", "load 5m"),
            target("node_load15", "load 15m"),
        ],
        x=12, y=5, w=12, h=8, unit="short", fill=15,
    ))
    # Row 3 — memory & disk
    panels.append(timeseries(
        "Memory (used / available / cached)",
        [
            target("node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes", "used"),
            target("node_memory_MemAvailable_bytes", "available"),
            target("node_memory_Cached_bytes", "cached"),
        ],
        x=0, y=13, w=12, h=8, unit="bytes",
    ))
    panels.append(timeseries(
        "Disk usage % (by mount)",
        [target('100 * (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes))', "{{mountpoint}}")],
        x=12, y=13, w=12, h=8, unit="percent",
        thresholds={"mode": "absolute", "steps": [
            {"color": "green", "value": None},
            {"color": "orange", "value": 80},
            {"color": "red", "value": 90},
        ]},
    ))
    # Row 4 — IO & network
    panels.append(timeseries(
        "Disk I/O (read / write)",
        [
            target('rate(node_disk_read_bytes_total{device!~"loop.*"}[1m])', "read {{device}}"),
            target('rate(node_disk_written_bytes_total{device!~"loop.*"}[1m])', "write {{device}}"),
        ],
        x=0, y=21, w=8, h=8, unit="Bps",
    ))
    panels.append(timeseries(
        "Network RX / TX",
        [
            target('rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[1m])', "RX {{device}}"),
            target('rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[1m])', "TX {{device}}"),
        ],
        x=8, y=21, w=8, h=8, unit="Bps",
    ))
    panels.append(timeseries(
        "TCP connections by state",
        [target("node_netstat_Tcp_CurrEstab", "established"),
         target("sum(node_sockstat_TCP_tw)", "time_wait"),
         target("sum(node_sockstat_TCP_alloc)", "allocated")],
        x=16, y=21, w=8, h=8, unit="short",
    ))
    # Row 5 — lms-server process view
    panels.append(row("LMS server process (Go)", y=29))
    panels.append(timeseries(
        "Process CPU (cores)",
        [target('rate(process_cpu_seconds_total{job="lms-server"}[1m])', "lms-server"),
         target('rate(process_cpu_seconds_total{job="lms-rtcd"}[1m])', "lms-rtcd")],
        x=0, y=30, w=8, h=7, unit="short",
    ))
    panels.append(timeseries(
        "Process RSS memory",
        [target('process_resident_memory_bytes{job="lms-server"}', "lms-server"),
         target('process_resident_memory_bytes{job="lms-rtcd"}', "lms-rtcd")],
        x=8, y=30, w=8, h=7, unit="bytes",
    ))
    panels.append(timeseries(
        "Open file descriptors",
        [target('process_open_fds{job="lms-server"}', "lms-server"),
         target('process_open_fds{job="lms-rtcd"}', "lms-rtcd")],
        x=16, y=30, w=8, h=7, unit="short",
    ))
    return dashboard(
        "LMS System Resources", "lms-system", panels,
        tags=["lms", "system"], refresh="30s", time_from="now-3h",
    )


def containers():
    reset_ids()
    panels = []
    container_var = var_query(
        "container", "Container",
        "label_values(container_cpu_usage_seconds_total, name)",
        default="All",
    )
    c = '{name=~"$container"}'
    panels.append(timeseries(
        "Container CPU (cores)",
        [target(
            f'rate(container_cpu_usage_seconds_total{c}[1m])', "{{name}}")],
        x=0, y=0, w=12, h=8, unit="short",
    ))
    panels.append(timeseries(
        "Container memory (working set)",
        [target(f'container_memory_working_set_bytes{c}', "{{name}}")],
        x=12, y=0, w=12, h=8, unit="bytes",
    ))
    panels.append(timeseries(
        "Container network RX",
        [target(
            f'rate(container_network_receive_bytes_total{c}[1m])', "{{name}}")],
        x=0, y=8, w=8, h=8, unit="Bps",
    ))
    panels.append(timeseries(
        "Container network TX",
        [target(
            f'rate(container_network_transmit_bytes_total{c}[1m])', "{{name}}")],
        x=8, y=8, w=8, h=8, unit="Bps",
    ))
    panels.append(timeseries(
        "Container memory usage vs limit",
        [target(
            f'container_memory_usage_bytes{c} / container_spec_memory_limit_bytes{c} * 100',
            "{{name}}")],
        x=16, y=8, w=8, h=8, unit="percent",
        thresholds={"mode": "absolute", "steps": [
            {"color": "green", "value": None},
            {"color": "orange", "value": 80},
            {"color": "red", "value": 95},
        ]},
    ))
    panels.append(timeseries(
        "Container restarts",
        [target(f'changes(container_start_time_seconds{c}[30m])', "{{name}}")],
        x=0, y=16, w=12, h=6, unit="short",
    ))
    panels.append(timeseries(
        "Container CPU throttled periods",
        [target(
            f'rate(container_cpu_cfs_throttled_periods_total{c}[1m])', "{{name}}")],
        x=12, y=16, w=12, h=6, unit="short",
    ))
    return dashboard(
        "LMS Containers", "lms-containers", panels,
        tags=["lms", "containers"], variables=[container_var],
        refresh="30s",
    )


if __name__ == "__main__":
    save(overview(), "lms-overview.json")
    save(system_resources(), "lms-system.json")
    save(containers(), "lms-containers.json")
