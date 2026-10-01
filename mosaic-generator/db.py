"""Read the mosaic configuration (enabled palette + parts) straight from the
shared MySQL database managed by the dashboard.

The table/column names here are the contract with the Prisma schema in
`../database/prisma/schema.prisma` (snake_case `@@map` names). All functions
fail soft: on any connection/query error (or empty config) they return None so
the caller can fall back to the built-in defaults.
"""

from __future__ import annotations

import os
from urllib.parse import unquote, urlparse

import pymysql
from dotenv import load_dotenv

load_dotenv()


def _connect():
    url = os.environ.get("DATABASE_URL")
    if not url:
        return None
    u = urlparse(url)
    return pymysql.connect(
        host=u.hostname or "127.0.0.1",
        port=u.port or 3306,
        user=unquote(u.username or ""),
        password=unquote(u.password or ""),
        database=(u.path or "/").lstrip("/"),
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=10,
    )


def load_palette_colors() -> list[dict] | None:
    """Colors of the single enabled palette, ordered by sort_order, shaped for
    `Palette`. `color_id` is the list index so the frontend's numeric colorMap
    keeps working; `part_id` is unused here (parts come from `load_parts`)."""
    conn = _connect()
    if conn is None:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM palettes WHERE enabled = 1 ORDER BY sort_order ASC LIMIT 1"
            )
            pal = cur.fetchone()
            if not pal:
                return None
            cur.execute(
                "SELECT name, r, g, b, code FROM colors "
                "WHERE palette_id = %s ORDER BY sort_order ASC",
                (pal["id"],),
            )
            rows = cur.fetchall()
        if not rows:
            return None
        return [
            {
                "rgb": (int(c["r"]), int(c["g"]), int(c["b"])),
                "name": c["name"],
                "code": c.get("code"),
                "color_id": i,
                "part_id": None,
            }
            for i, c in enumerate(rows)
        ]
    except Exception:
        return None
    finally:
        conn.close()


def load_parts() -> list[dict] | None:
    """Enabled bricks, ordered by sort_order. `variable` on the 1x1 part is the
    max 1x1 fraction cap. Bases (kind = 'BASE') are what the mosaic is built on,
    not something to tile with, so they're excluded."""
    conn = _connect()
    if conn is None:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name, part_id, width, height, variable FROM parts "
                "WHERE enabled = 1 AND kind = 'BRICK' ORDER BY sort_order ASC"
            )
            rows = cur.fetchall()
        if not rows:
            return None
        return [
            {
                "width": int(r["width"]),
                "height": int(r["height"]),
                "part_id": r["part_id"],
                "name": r["name"],
                "variable": float(r["variable"]) if r["variable"] is not None else None,
            }
            for r in rows
        ]
    except Exception:
        return None
    finally:
        conn.close()


def load_base() -> dict | None:
    """The base the mosaic is built on: the first enabled `kind = 'BASE'` part
    by sort_order. The dashboard only lets bases be enabled if they fit every
    enabled brick, so when several are enabled any of them is valid; the first
    is used. None (no base, or DB unavailable) keeps the pre-base behavior."""
    conn = _connect()
    if conn is None:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name, part_id, width, height FROM parts "
                "WHERE enabled = 1 AND kind = 'BASE' ORDER BY sort_order ASC LIMIT 1"
            )
            r = cur.fetchone()
        if not r:
            return None
        return {
            "width": int(r["width"]),
            "height": int(r["height"]),
            "part_id": r["part_id"],
            "name": r["name"],
        }
    except Exception:
        return None
    finally:
        conn.close()
