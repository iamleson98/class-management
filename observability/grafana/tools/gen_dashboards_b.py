#!/usr/bin/env python3
"""Generate LMS dashboards batch B: HTTP API, chat/websocket, uploads/storage, database."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dash_lib import (  # noqa: E402
    reset_ids, timeseries, stat, row, dashboard, save, target,
)


def http_api():
    reset_ids()
    panels = []
    panels.append(stat(
        "Requests / s (5m avg)",
        [target("sum(rate(mattermost_http_requests_total[5m]))", "", instant=True)],
        x=0, y=0, w=4, h=4, unit="reqps", legend_fmt="",
    ))
    panels.append(stat(
        "Errors / s (5m avg)",
        [target("sum(rate(mattermost_http_errors_total[5m]))", "", instant=True)],
        x=4, y=0, w=4, h=4, unit="reqps", legend_fmt="",
    ))
    panels.append(stat(
        "Error ratio",
        [target(
            "100 * sum(rate(mattermost_http_errors_total[5m])) / sum(rate(mattermost_http_requests_total[5m]))",
            "", instant=True)],
        x=8, y=0, w=4, h=4, unit="percent", thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "green", "value": None},
                {"color": "orange", "value": 2},
                {"color": "red", "value": 5},
            ],
        }, legend_fmt="",
    ))
    panels.append(stat(
        "API p95 latency",
        [target(
            "histogram_quantile(0.95, sum by (le) (rate(mattermost_api_time_bucket[5m])))",
            "", instant=True)],
        x=12, y=0, w=4, h=4, unit="s", thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "green", "value": None},
                {"color": "orange", "value": 1},
                {"color": "red", "value": 2},
            ],
        }, legend_fmt="",
    ))
    panels.append(stat(
        "Slowest endpoint (p95)",
        [target(
            "topk(1, histogram_quantile(0.95, sum by (handler, le) (rate(mattermost_api_time_bucket[5m]))))",
            "", instant=True)],
        x=16, y=0, w=4, h=4, unit="s", legend_fmt="",
    ))
    panels.append(stat(
        "Etag hit ratio",
        [target(
            "100 * sum(rate(mattermost_cache_etag_hit_total[10m])) / (sum(rate(mattermost_cache_etag_hit_total[10m])) + sum(rate(mattermost_cache_etag_miss_total[10m])))",
            "", instant=True)],
        x=20, y=0, w=4, h=4, unit="percent", legend_fmt="",
    ))
    panels.append(timeseries(
        "API calls / s by status code",
        [target(
            "sum by (status_code) (rate(mattermost_api_time_bucket[5m]))", "{{status_code}}")],
        x=0, y=4, w=12, h=8, unit="reqps", stack=True, fill=25,
    ))
    panels.append(timeseries(
        "API latency p50 / p95 / p99",
        [
            target("histogram_quantile(0.50, sum by (le) (rate(mattermost_api_time_bucket[5m])))", "p50"),
            target("histogram_quantile(0.95, sum by (le) (rate(mattermost_api_time_bucket[5m])))", "p95"),
            target("histogram_quantile(0.99, sum by (le) (rate(mattermost_api_time_bucket[5m])))", "p99"),
        ],
        x=12, y=4, w=12, h=8, unit="s",
    ))
    panels.append(timeseries(
        "API calls / s by method",
        [target(
            "sum by (method) (rate(mattermost_api_time_bucket[5m]))", "{{method}}")],
        x=0, y=12, w=8, h=8, unit="reqps", stack=True, fill=25,
    ))
    panels.append(timeseries(
        "API calls / s by origin client",
        [target(
            "sum by (origin_client) (rate(mattermost_api_time_bucket[5m]))", "{{origin_client}}")],
        x=8, y=12, w=8, h=8, unit="reqps", stack=True, fill=25,
    ))
    panels.append(timeseries(
        "Etag hits vs misses",
        [
            target("sum(rate(mattermost_cache_etag_hit_total[5m]))", "hits"),
            target("sum(rate(mattermost_cache_etag_miss_total[5m]))", "misses"),
        ],
        x=16, y=12, w=8, h=8, unit="reqps",
    ))
    panels.append(row("Slowest endpoints (p95, top 15)", y=20))
    panels.append(timeseries(
        "Endpoint latency p95 — top 15",
        [target(
            "topk(15, histogram_quantile(0.95, sum by (handler, le) (rate(mattermost_api_time_bucket[5m]))))",
            "{{handler}}")],
        x=0, y=21, w=24, h=9, unit="s", legend_mode="table",
        legend_calcs=["lastNotNull"],
    ))
    return dashboard("LMS HTTP API", "lms-http-api", panels,
                     tags=["lms", "api"], refresh="30s")


def chat_websocket():
    reset_ids()
    panels = []
    panels.append(stat(
        "Posts / min",
        [target("sum(rate(mattermost_post_total[5m])) * 60", "", instant=True)],
        x=0, y=0, w=4, h=4, unit="short", decimals=1, legend_fmt="",
    ))
    panels.append(stat(
        "WebSocket connections",
        [target("sum(mattermost_http_websockets_total)", "", instant=True)],
        x=4, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "WS events / s",
        [target("sum(rate(mattermost_websocket_event_total[5m]))", "", instant=True)],
        x=8, y=0, w=4, h=4, unit="ops", decimals=1, legend_fmt="",
    ))
    panels.append(stat(
        "Post broadcasts / min",
        [target("sum(rate(mattermost_post_broadcasts_total[5m])) * 60", "", instant=True)],
        x=12, y=0, w=4, h=4, unit="short", decimals=1, legend_fmt="",
    ))
    panels.append(stat(
        "Mem cache hit ratio",
        [target(
            "100 * sum(rate(mattermost_cache_mem_hit_total[10m])) / (sum(rate(mattermost_cache_mem_hit_total[10m])) + sum(rate(mattermost_cache_mem_miss_total[10m])))",
            "", instant=True)],
        x=16, y=0, w=4, h=4, unit="percent", legend_fmt="",
    ))
    panels.append(stat(
        "WS reconnects / min",
        [target("sum(rate(mattermost_websocket_reconnects_total[5m])) * 60 or vector(0)", "", instant=True)],
        x=20, y=0, w=4, h=4, unit="short", decimals=1, legend_fmt="",
    ))
    panels.append(timeseries(
        "Posts created / min (total + with files)",
        [
            target("sum(rate(mattermost_post_total[1m])) * 60", "posts"),
            target("sum(rate(mattermost_post_file_attachments_total[1m])) * 60", "file attachments"),
        ],
        x=0, y=4, w=8, h=8, unit="short", fill=15,
    ))
    panels.append(timeseries(
        "WebSocket connections by origin",
        [target("mattermost_http_websockets_total", "{{origin_client}}")],
        x=8, y=4, w=8, h=8, unit="short", stack=True, fill=30,
    ))
    panels.append(timeseries(
        "WebSocket events / s by type (top 12)",
        [target(
            "topk(12, sum by (type) (rate(mattermost_websocket_event_total[5m])))", "{{type}}")],
        x=16, y=4, w=8, h=8, unit="ops", stack=True, fill=30,
    ))
    panels.append(timeseries(
        "Broadcasts / s by event name (top 12)",
        [target(
            "topk(12, sum by (name) (rate(mattermost_websocket_broadcasts_total[5m])))", "{{name}}")],
        x=0, y=12, w=8, h=8, unit="ops", stack=True, fill=30,
    ))
    panels.append(timeseries(
        "WS reconnects by disconnect error",
        [target(
            'sum by (disconnect_err_code) (rate(mattermost_websocket_reconnects_total[5m]))',
            "{{disconnect_err_code}}")],
        x=8, y=12, w=8, h=8, unit="ops",
    ))
    panels.append(timeseries(
        "Cache hits vs misses / s",
        [
            target("sum(rate(mattermost_cache_mem_hit_total[5m]))", "hits"),
            target("sum(rate(mattermost_cache_mem_miss_total[5m]))", "misses"),
        ],
        x=16, y=12, w=8, h=8, unit="ops",
    ))
    panels.append(row("Websocket internals", y=20))
    panels.append(timeseries(
        "Broadcast buffer size (per hub)",
        [target("mattermost_websocket_broadcast_buffer_size", "hub {{hub}}")],
        x=0, y=21, w=8, h=7, unit="short",
    ))
    panels.append(timeseries(
        "Users registered per hub",
        [target("mattermost_websocket_broadcast_buffer_users_registered", "hub {{hub}}")],
        x=8, y=21, w=8, h=7, unit="short",
    ))
    panels.append(timeseries(
        "Store method latency p95 (top 10)",
        [target(
            "topk(10, histogram_quantile(0.95, sum by (method, le) (rate(mattermost_db_store_time_bucket[5m]))))",
            "{{method}}")],
        x=16, y=21, w=8, h=7, unit="s", legend_mode="table",
        legend_calcs=["lastNotNull"],
    ))
    return dashboard("LMS Chat & WebSocket", "lms-chat-ws", panels,
                     tags=["lms", "chat"], refresh="30s")


def uploads_storage():
    reset_ids()
    panels = []
    panels.append(stat(
        "Uploads / min (success)",
        [target(
            'sum(rate(mattermost_file_upload_duration_seconds_count{success="true"}[10m])) * 60',
            "", instant=True)],
        x=0, y=0, w=4, h=4, unit="short", decimals=1, legend_fmt="",
    ))
    panels.append(stat(
        "Upload failures / min",
        [target(
            "sum(rate(mattermost_file_upload_failures_total[10m])) * 60 or vector(0)", "", instant=True)],
        x=4, y=0, w=4, h=4, unit="short", decimals=1, thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "green", "value": None},
                {"color": "orange", "value": 0.1},
                {"color": "red", "value": 1},
            ],
        }, legend_fmt="",
    ))
    panels.append(stat(
        "Upload p95 duration",
        [target(
            'histogram_quantile(0.95, sum by (le) (rate(mattermost_file_upload_duration_seconds_bucket{success="true"}[10m])))',
            "", instant=True)],
        x=8, y=0, w=4, h=4, unit="s", legend_fmt="",
    ))
    panels.append(stat(
        "Bytes uploaded / min",
        [target("rate(mattermost_file_upload_bytes_total[10m]) * 60", "", instant=True)],
        x=12, y=0, w=4, h=4, unit="Bps", legend_fmt="",
    ))
    panels.append(stat(
        "S3 requests / s",
        [target(
            "sum(rate(mattermost_filestore_s3_request_duration_seconds_count[5m]))",
            "", instant=True)],
        x=16, y=0, w=4, h=4, unit="ops", decimals=1, legend_fmt="",
    ))
    panels.append(stat(
        "S3 error responses / min",
        [target(
            'sum(rate(mattermost_filestore_s3_request_duration_seconds_count{code=~"4xx|5xx|err"}[10m])) * 60 or vector(0)',
            "", instant=True)],
        x=20, y=0, w=4, h=4, unit="short", decimals=1, thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "green", "value": None},
                {"color": "orange", "value": 1},
                {"color": "red", "value": 10},
            ],
        }, legend_fmt="",
    ))
    panels.append(timeseries(
        "Uploads / min by success",
        [target(
            "sum by (success) (rate(mattermost_file_upload_duration_seconds_count[5m])) * 60",
            "success={{success}}")],
        x=0, y=4, w=8, h=8, unit="short",
    ))
    panels.append(timeseries(
        "Upload duration p50 / p95 / p99",
        [
            target('histogram_quantile(0.50, sum by (le) (rate(mattermost_file_upload_duration_seconds_bucket{success="true"}[10m])))', "p50"),
            target('histogram_quantile(0.95, sum by (le) (rate(mattermost_file_upload_duration_seconds_bucket{success="true"}[10m])))', "p95"),
            target('histogram_quantile(0.99, sum by (le) (rate(mattermost_file_upload_duration_seconds_bucket{success="true"}[10m])))', "p99"),
        ],
        x=8, y=4, w=8, h=8, unit="s",
    ))
    panels.append(timeseries(
        "Upload bytes / s",
        [target("rate(mattermost_file_upload_bytes_total[5m])", "bytes/s")],
        x=16, y=4, w=8, h=8, unit="Bps", fill=15,
    ))
    panels.append(timeseries(
        "Upload failures / min by stage",
        [target(
            "sum by (stage) (rate(mattermost_file_upload_failures_total[5m])) * 60",
            "{{stage}}")],
        x=0, y=12, w=8, h=8, unit="short",
    ))
    panels.append(timeseries(
        "S3 requests / s by operation",
        [target(
            "sum by (operation) (rate(mattermost_filestore_s3_request_duration_seconds_count[5m]))",
            "{{operation}}")],
        x=8, y=12, w=8, h=8, unit="ops", stack=True, fill=25,
    ))
    panels.append(timeseries(
        "S3 requests / s by response code",
        [target(
            "sum by (code) (rate(mattermost_filestore_s3_request_duration_seconds_count[5m]))",
            "{{code}}")],
        x=16, y=12, w=8, h=8, unit="ops", stack=True, fill=25,
    ))
    panels.append(row("S3 / RustFS latency & LMS media", y=20))
    panels.append(timeseries(
        "S3 request latency p95 by operation",
        [target(
            "histogram_quantile(0.95, sum by (operation, le) (rate(mattermost_filestore_s3_request_duration_seconds_bucket[5m])))",
            "{{operation}}")],
        x=0, y=21, w=8, h=8, unit="s",
    ))
    panels.append(timeseries(
        "Class media created / deleted (total)",
        [
            target("mattermost_lms_class_media_created_total", "created"),
            target("mattermost_lms_class_media_deleted_total", "deleted"),
        ],
        x=8, y=21, w=8, h=8, unit="short",
    ))
    panels.append(timeseries(
        "File attachments in posts / min",
        [target("sum(rate(mattermost_post_file_attachments_total[5m])) * 60", "attachments")],
        x=16, y=21, w=8, h=8, unit="short", fill=15,
    ))
    return dashboard("LMS Uploads & Storage (S3/RustFS)", "lms-uploads",
                     panels, tags=["lms", "files"], refresh="30s")


def database():
    reset_ids()
    panels = []
    panels.append(stat(
        "Open connections",
        [target('mattermost_db_open_connections{db_name="master"}', "", instant=True)],
        x=0, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "In-use connections",
        [target('mattermost_db_in_use_connections{db_name="master"}', "", instant=True)],
        x=4, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "Idle connections",
        [target('mattermost_db_idle_connections{db_name="master"}', "", instant=True)],
        x=8, y=0, w=4, h=4, unit="short", legend_fmt="",
    ))
    panels.append(stat(
        "Conn wait / min",
        [target('rate(mattermost_db_wait_count_total{db_name="master"}[5m]) * 60', "", instant=True)],
        x=12, y=0, w=4, h=4, unit="short", decimals=1, thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "green", "value": None},
                {"color": "orange", "value": 1},
                {"color": "red", "value": 10},
            ],
        }, legend_fmt="",
    ))
    panels.append(stat(
        "Store p95 latency",
        [target(
            "histogram_quantile(0.95, sum by (le) (rate(mattermost_db_store_time_bucket[5m])))",
            "", instant=True)],
        x=16, y=0, w=4, h=4, unit="s", thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "green", "value": None},
                {"color": "orange", "value": 0.5},
                {"color": "red", "value": 1},
            ],
        }, legend_fmt="",
    ))
    panels.append(stat(
        "PG cache hit ratio",
        [target(
            "100 * sum(rate(pg_stat_database_blks_hit[10m])) / (sum(rate(pg_stat_database_blks_hit[10m])) + sum(rate(pg_stat_database_blks_read[10m])))",
            "", instant=True)],
        x=20, y=0, w=4, h=4, unit="percent", thresholds={
            "mode": "absolute",
            "steps": [
                {"color": "red", "value": None},
                {"color": "orange", "value": 95},
                {"color": "green", "value": 99},
            ],
        }, legend_fmt="",
    ))
    panels.append(timeseries(
        "Go sql.DB connections (open / in-use / idle)",
        [
            target('mattermost_db_open_connections{db_name="master"}', "open"),
            target('mattermost_db_in_use_connections{db_name="master"}', "in use"),
            target('mattermost_db_idle_connections{db_name="master"}', "idle"),
        ],
        x=0, y=4, w=8, h=8, unit="short",
    ))
    panels.append(timeseries(
        "Connection waits / min + wait duration",
        [
            target('rate(mattermost_db_wait_count_total{db_name="master"}[5m]) * 60', "waits/min"),
            target('rate(mattermost_db_wait_duration_seconds_total{db_name="master"}[5m])', "wait s/s"),
        ],
        x=8, y=4, w=8, h=8, unit="short",
    ))
    panels.append(timeseries(
        "Store method latency p95 (top 10 slowest)",
        [target(
            "topk(10, histogram_quantile(0.95, sum by (method, le) (rate(mattermost_db_store_time_bucket[5m]))))",
            "{{method}}")],
        x=16, y=4, w=8, h=8, unit="s", legend_mode="table",
        legend_calcs=["lastNotNull"],
    ))
    panels.append(row("PostgreSQL internals (postgres-exporter)", y=12))
    panels.append(timeseries(
        "Postgres transactions / s (by db)",
        [target("sum by (datname) (rate(pg_stat_database_xact_commit[5m]))", "{{datname}}")],
        x=0, y=13, w=8, h=8, unit="ops",
    ))
    panels.append(timeseries(
        "Postgres cache hit ratio",
        [target(
            "100 * sum by (datname) (rate(pg_stat_database_blks_hit[5m])) / (sum by (datname) (rate(pg_stat_database_blks_hit[5m])) + sum by (datname) (rate(pg_stat_database_blks_read[5m])))",
            "{{datname}}")],
        x=8, y=13, w=8, h=8, unit="percent",
    ))
    panels.append(timeseries(
        "Deadlocks & conflicts / min",
        [
            target("sum(rate(pg_stat_database_deadlocks[5m])) * 60", "deadlocks"),
            target("sum(rate(pg_stat_database_conflicts[5m])) * 60", "conflicts"),
        ],
        x=16, y=13, w=8, h=8, unit="short",
    ))
    panels.append(timeseries(
        "Table size (top 10)",
        [target(
            "topk(10, pg_total_relation_size)", "{{relname}}")],
        x=0, y=21, w=8, h=8, unit="bytes",
    ))
    panels.append(timeseries(
        "Dead tuples (top 10, autovacuum backlog)",
        [target(
            "topk(10, pg_stat_user_tables_n_dead_tup)", "{{relname}}")],
        x=8, y=21, w=8, h=8, unit="short",
    ))
    panels.append(timeseries(
        "Active DB users (server-side gauge)",
        [target("mattermost_db_active_users", "active users")],
        x=16, y=21, w=8, h=8, unit="short",
    ))
    return dashboard("LMS Database", "lms-database", panels,
                     tags=["lms", "database"], refresh="30s")


if __name__ == "__main__":
    save(http_api(), "lms-http-api.json")
    save(chat_websocket(), "lms-chat-ws.json")
    save(uploads_storage(), "lms-uploads.json")
    save(database(), "lms-database.json")
