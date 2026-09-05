#!/usr/bin/env python3
"""Shared helpers for building the LMS Grafana dashboards.

Produces Grafana 10.4-compatible dashboard JSON (schemaVersion 39) with the
Prometheus datasource provisioned under uid "prometheus".
"""

import json
import os

DS = {"type": "prometheus", "uid": "prometheus"}
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dashboards")

UNIT_MAP = {
    "reqps": "reqps", "percent": "percent", "bytes": "bytes",
    "bps": "Bps", "seconds": "s", "ms": "ms", "short": "short",
    "none": "none", "ops": "ops", "decbytes": "decbytes",
}

_id = [0]


def next_id():
    _id[0] += 1
    return _id[0]


def reset_ids():
    _id[0] = 0


def _unique_refs(targets):
    """Re-assign sequential refIds (A, B, C...) per panel.

    Grafana rejects panels whose queries share a refId ("Multiple queries
    using the same RefId is not allowed"). All our targets are plain
    Prometheus expressions, so positional re-lettering is always safe.
    """
    import string
    out = []
    for i, t in enumerate(targets):
        t = dict(t)
        t["refId"] = string.ascii_uppercase[i] if i < 26 else "T%d" % (i + 1)
        out.append(t)
    return out


def target(expr, legend="__auto", ref="A", instant=False):
    t = {
        "refId": ref,
        "expr": expr,
        "datasource": DS,
        "editorMode": "code",
        "range": not instant,
        "instant": instant,
        "legendFormat": legend,
    }
    return t


def timeseries(title, targets, x=0, y=0, w=12, h=8, unit="none",
               legend_mode="list", legend_placement="bottom",
               thresholds=None, desc=None, interval=None, fill=8, stack=False,
               legend_calcs=None, decimals=None):
    defaults = {
        "unit": unit,
        "custom": {
            "axisCenteredZero": False,
            "axisColorMode": "text",
            "axisLabel": "",
            "axisPlacement": "auto",
            "barAlignment": 0,
            "drawStyle": "line",
            "fillOpacity": fill,
            "gradientMode": "opacity",
            "hideFrom": {"legend": False, "tooltip": False, "viz": False},
            "lineInterpolation": "linear",
            "lineWidth": 1,
            "pointSize": 3,
            "scaleDistribution": {"type": "linear"},
            "showPoints": "never",
            "spanNulls": False,
            "stacking": {"group": "A", "mode": "normal" if stack else "off"},
            "thresholdsStyle": {"mode": "line" if thresholds else "off"},
        },
        "color": {"mode": "palette-classic", "fixedColor": "green"},
        "mappings": [],
        "thresholds": thresholds or {
            "mode": "absolute",
            "steps": [{"color": "green", "value": None}],
        },
    }
    if decimals is not None:
        defaults["decimals"] = decimals
    p = {
        "id": next_id(),
        "type": "timeseries",
        "title": title,
        "description": desc or "",
        "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {"defaults": defaults, "overrides": []},
        "options": {
            "legend": {
                "displayMode": legend_mode,
                "placement": legend_placement,
                "calcs": legend_calcs or [],
                "showLegend": True,
            },
            "tooltip": {"mode": "multi", "sort": "desc"},
        },
        "targets": _unique_refs(targets),
    }
    if interval:
        p["interval"] = interval
    return p


def stat(title, targets, x=0, y=0, w=4, h=4, unit="none", thresholds=None,
         color_mode="background", decimals=None, desc=None,
         calcs="lastNotNull", legend_fmt=None):
    """Stat tile.

    NOTE on color config: options.colorMode (auto/value/background/none)
    controls WHERE the color is painted and "background" is a valid value
    there. The fieldConfig.defaults.color.mode is a different setting — it
    must be one of the registry modes (fixed/shades/thresholds/
    threshold-classic/...). Passing "background" there produces the
    "background not found in: fixed, shades, threshold-classic, ..." panel
    error and renders a blank tile, so it is pinned to "thresholds" here
    (the same mode the gauge panels use successfully).
    """
    p = {
        "id": next_id(),
        "type": "stat",
        "title": title,
        "description": desc or "",
        "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "mappings": [],
                "color": {"mode": "thresholds"},
                "thresholds": thresholds or {
                    "mode": "absolute",
                    "steps": [{"color": "green", "value": None}],
                },
            },
            "overrides": [],
        },
        "options": {
            "reduceOptions": {
                "values": False,
                "calcs": [calcs],
                "fields": "",
            },
            "orientation": "auto",
            "textMode": "auto",
            "colorMode": color_mode,
            "graphMode": "none",
            "justifyMode": "auto",
            "displayMode": "auto",
        },
        "targets": _unique_refs(targets),
    }
    if decimals is not None:
        p["fieldConfig"]["defaults"]["decimals"] = decimals
    if legend_fmt:
        for t in p["targets"]:
            t["legendFormat"] = legend_fmt
    return p


def gauge(title, targets, x=0, y=0, w=4, h=4, unit="percent",
          thresholds=None, min=0, max=100, desc=None):
    p = {
        "id": next_id(),
        "type": "gauge",
        "title": title,
        "description": desc or "",
        "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "min": min,
                "max": max,
                "mappings": [],
                "color": {"mode": "thresholds"},
                "thresholds": thresholds or {
                    "mode": "absolute",
                    "steps": [{"color": "green", "value": None}],
                },
            },
            "overrides": [],
        },
        "options": {
            "reduceOptions": {"values": False, "calcs": ["lastNotNull"], "fields": ""},
            "orientation": "auto",
            "showThresholdLabels": False,
            "showThresholdMarkers": True,
        },
        "targets": _unique_refs(targets),
    }
    return p


def table(title, targets, x=0, y=0, w=24, h=8, desc=None, instant=True,
          format="table"):
    p = {
        "id": next_id(),
        "type": "table",
        "title": title,
        "description": desc or "",
        "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {"defaults": {}, "overrides": []},
        "options": {
            "showHeader": True,
            "cellHeight": "sm",
            "footer": {"countRows": False, "fields": "", "enablePagination": True, "reducer": ["sum"]},
        },
        "transformations": [
            {"id": "organize", "options": {
                "excludeByName": {"Time": True, " __auto__": True},
                "renameByName": {"Value": "p95 (s)"},
            }},
        ],
        "targets": _unique_refs(
            [dict(t, format=format, instant=instant) for t in targets]),
    }
    return p


def row(title, y=0):
    return {
        "id": next_id(),
        "type": "row",
        "title": title,
        "collapsed": False,
        "gridPos": {"h": 1, "w": 24, "x": 0, "y": y},
        "panels": [],
    }


def dashboard(title, uid, panels, tags=None, variables=None, refresh="30s",
              time_from="now-3h"):
    d = {
        "annotations": {
            "list": [
                {
                    "builtIn": 1,
                    "datasource": {"type": "grafana", "uid": "-- Grafana --"},
                    "enable": True,
                    "hide": True,
                    "iconColor": "rgba(0, 211, 255, 1)",
                    "name": "Annotations & Alerts",
                    "type": "dashboard",
                }
            ]
        },
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 1,
        "id": None,
        "links": [],
        "panels": panels,
        "refresh": refresh,
        "schemaVersion": 39,
        "tags": tags or ["lms"],
        "templating": {"list": variables or []},
        "time": {"from": time_from, "to": "now"},
        "timepicker": {},
        "timezone": "browser",
        "title": title,
        "uid": uid,
        "version": 1,
        "weekStart": "",
        "liveNow": False,
    }
    return d


def var_query(name, label, query, multi=True, include_all=True, default="All",
              tag_datasource=True):
    v = {
        "name": name,
        "label": label,
        "type": "query",
        "datasource": DS,
        "definition": query,
        "query": {"query": query, "refId": "StandardVariableQuery"},
        "refresh": 2,
        "regex": "",
        "skipUrlSync": False,
        "sort": 1,
        "multi": multi,
        "includeAll": include_all,
        "allValue": default if default != "All" else ".*",
        "current": {"selected": True, "text": ["All"], "value": ["$__all"]},
        "hide": 0,
    }
    return v


def save(dash, fname):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, fname)
    with open(path, "w") as f:
        json.dump(dash, f, indent=2)
    print(f"wrote {path} ({len(dash['panels'])} panels)")
