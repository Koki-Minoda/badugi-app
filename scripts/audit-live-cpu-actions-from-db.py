#!/usr/bin/env python3
"""Read-only live DB audit for CPU action tendencies.

The script intentionally avoids printing database URLs, player identifiers, or
raw metadata. It only emits aggregate, masked reports under reports/.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

try:
    from sqlalchemy import create_engine, inspect, text
    from sqlalchemy.exc import SQLAlchemyError
except Exception:  # pragma: no cover - allows report generation without deps.
    create_engine = None
    inspect = None
    text = None
    SQLAlchemyError = Exception


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "reports/ai/live-db-cpu-action-audit.json"
CPU_NAME_HINTS = {
    "ren",
    "sora",
    "hana",
    "jun",
    "mina",
    "emi",
    "rei",
    "akira",
    "cpu",
    "bot",
}
HERO_HINTS = {"hero", "you", "player", "human"}
ACTION_BUCKETS = ("fold", "check", "call", "bet", "raise", "draw", "pat", "showdown")
DECISION_SOURCE_KEYS = {
    "decisionSource",
    "decision_source",
    "cpuPolicy",
    "cpu_policy",
    "aiTier",
    "ai_tier",
    "tierId",
    "tier_id",
    "rlUsed",
    "rl_used",
    "fallbackReason",
    "fallback_reason",
    "legalActions",
    "legal_actions",
    "stateVectorVersion",
    "state_vector_version",
}


@dataclass
class TableShape:
    name: str
    columns: set[str]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        values[key.strip()] = value
    return values


def env_value(env: dict[str, str], key: str, default: str | None = None) -> str | None:
    return os.environ.get(key) or env.get(key) or default


def discover_db_url() -> tuple[str | None, str]:
    env = parse_env_file(ROOT / "backend/.env")
    root_env = parse_env_file(ROOT / ".env")
    merged = {**root_env, **env}
    explicit = (
        env_value(merged, "DATABASE_URL")
        or env_value(merged, "SQLALCHEMY_DATABASE_URL")
        or env_value(merged, "MGX_DATABASE_URL")
        or env_value(merged, "BACKEND_DATABASE_URL")
    )
    if explicit:
        return explicit, "explicit-env-url"

    driver = (env_value(merged, "BACKEND_DB_DRIVER", "mysql") or "mysql").lower()
    db_name = env_value(merged, "BACKEND_DB_NAME", "mgx_prod") or "mgx_prod"
    if driver in {"sqlite", "sqlite3"}:
        candidate = Path(db_name)
        if not candidate.is_absolute():
            candidate = ROOT / candidate
        return f"sqlite+pysqlite:///{candidate}", "backend-env-sqlite"

    password = env_value(merged, "BACKEND_DB_PASSWORD")
    user = env_value(merged, "BACKEND_DB_USER", "mgx") or "mgx"
    host = env_value(merged, "BACKEND_DB_HOST", "localhost") or "localhost"
    port = env_value(merged, "BACKEND_DB_PORT", "3306") or "3306"
    if password:
        dialect = "mysql+pymysql"
        if driver in {"postgres", "postgresql", "postgresql+psycopg"}:
            dialect = "postgresql+psycopg"
        auth = quote_plus(user)
        pwd = quote_plus(password)
        return f"{dialect}://{auth}:{pwd}@{host}:{port}/{db_name}", "backend-env-fields"

    sqlite_candidates = [
        *ROOT.glob("*.db"),
        *ROOT.glob("*.sqlite"),
        *ROOT.glob("*.sqlite3"),
        *ROOT.glob("backend/*.db"),
        *ROOT.glob("backend/*.sqlite"),
        *ROOT.glob("backend/*.sqlite3"),
    ]
    if sqlite_candidates:
        return f"sqlite+pysqlite:///{sqlite_candidates[0]}", "local-sqlite-discovery"
    return None, "not-configured"


def masked_db_kind(db_url: str | None, source: str) -> dict[str, Any]:
    if not db_url:
        return {"configured": False, "source": source, "dialect": None}
    dialect = db_url.split(":", 1)[0]
    return {"configured": True, "source": source, "dialect": dialect}


def normalize_json(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def row_metadata(row: dict[str, Any]) -> dict[str, Any]:
    metadata = normalize_json(row.get("metadata") or row.get("metadata_json"))
    hand_metadata = normalize_json(row.get("hand_metadata"))
    if hand_metadata:
        return {**hand_metadata, **metadata}
    return metadata


def nested_get(metadata: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in metadata:
            return metadata[key]
    for value in metadata.values():
        if isinstance(value, dict):
            found = nested_get(value, *keys)
            if found is not None:
                return found
    return None


def normalize_action(action: Any) -> str:
    label = str(action or "").strip().lower()
    if label.startswith("raise"):
        return "raise"
    if label.startswith("bet"):
        return "bet"
    if label.startswith("call"):
        return "call"
    if label.startswith("check"):
        return "check"
    if label.startswith("fold"):
        return "fold"
    if label.startswith("draw"):
        return "draw"
    if label.startswith("pat"):
        return "pat"
    if label.startswith("show"):
        return "showdown"
    if label.startswith("collect"):
        return "showdown"
    if "all-in" in label:
        return "call"
    return label or "unknown"


def safe_variant(row: dict[str, Any], metadata: dict[str, Any]) -> str:
    for key in ("variant_id", "variantId", "game_id", "gameId"):
        value = row.get(key) or nested_get(metadata, key)
        if value:
            return str(value)
    return "unknown"


def safe_mode(row: dict[str, Any], metadata: dict[str, Any]) -> str:
    for key in ("mode", "gameMode", "game_mode"):
        value = row.get(key) or nested_get(metadata, key)
        if value:
            return str(value)
    if row.get("tournament_id") or nested_get(metadata, "tournamentId", "tournament_id"):
        return "tournament"
    return "unknown"


def player_kind(row: dict[str, Any], metadata: dict[str, Any], hero_seat: Any = None) -> tuple[str, bool]:
    explicit_cpu = row.get("is_cpu")
    if explicit_cpu is None:
        explicit_cpu = nested_get(metadata, "isCpu", "isCPU", "is_cpu")
    if explicit_cpu is not None:
        return ("cpu" if bool(explicit_cpu) else "hero", False)

    player_type = row.get("player_type") or nested_get(metadata, "playerType", "player_type", "actorType")
    if player_type:
        lowered = str(player_type).lower()
        if "cpu" in lowered or "bot" in lowered:
            return "cpu", False
        if "hero" in lowered or "human" in lowered:
            return "hero", False

    player_id = str(row.get("player_id") or "").lower()
    player_name = str(row.get("player_name") or row.get("seat_name") or nested_get(metadata, "seatName", "playerName") or "").lower()
    combined = f"{player_id} {player_name}"
    if any(hint in combined for hint in HERO_HINTS):
        return "hero", True
    if any(hint in combined for hint in CPU_NAME_HINTS):
        return "cpu", True
    seat = row.get("seat_index")
    if hero_seat is not None and seat is not None and str(seat) != str(hero_seat):
        return "cpu", True
    return "unknown", False


def decision_source_value(metadata: dict[str, Any]) -> Any:
    value = nested_get(metadata, "decisionSource", "decision_source", "cpuPolicy", "cpu_policy", "aiTier", "ai_tier", "tierId", "tier_id", "rlUsed", "rl_used")
    if value is not None:
        return value
    generic_source = nested_get(metadata, "source")
    if generic_source and str(generic_source).lower() not in {"syncmanager", "hand-history", "history"}:
        return generic_source
    return None


def has_decision_source(table_columns: set[str], rows: list[dict[str, Any]]) -> tuple[str, list[str]]:
    direct = sorted(DECISION_SOURCE_KEYS.intersection(table_columns))
    metadata_hits: set[str] = set()
    for row in rows:
        metadata = row_metadata(row)
        for key in DECISION_SOURCE_KEYS:
            if nested_get(metadata, key) is not None:
                metadata_hits.add(key)
    if direct or metadata_hits:
        return "DECISION_SOURCE_AVAILABLE", sorted(set(direct) | metadata_hits)
    return "DECISION_SOURCE_NOT_PERSISTED", []


def init_bucket() -> dict[str, Any]:
    return {
        "actions": 0,
        "hands": set(),
        "actionCounts": Counter(),
        "voluntaryActions": 0,
        "raiseOrBet": 0,
        "showdowns": 0,
        "potSamples": [],
        "decisionSources": Counter(),
        "fallbackReasons": Counter(),
        "cpuIdentityInferred": 0,
    }


def finalize_bucket(bucket: dict[str, Any]) -> dict[str, Any]:
    actions = bucket["actions"]
    folds = bucket["actionCounts"].get("fold", 0)
    calls = bucket["actionCounts"].get("call", 0)
    raises = bucket["actionCounts"].get("raise", 0) + bucket["actionCounts"].get("bet", 0)
    showdowns = bucket["showdowns"]
    pots = bucket["potSamples"]
    return {
        "hands": len(bucket["hands"]),
        "actions": actions,
        "actionCounts": dict(sorted(bucket["actionCounts"].items())),
        "foldRate": round(folds / actions, 4) if actions else None,
        "vpipProxyRate": round(bucket["voluntaryActions"] / actions, 4) if actions else None,
        "raiseOpenCount": raises,
        "callCount": calls,
        "showdownCount": showdowns,
        "averagePotSample": round(sum(pots) / len(pots), 2) if pots else None,
        "decisionSources": dict(sorted(bucket["decisionSources"].items())),
        "fallbackReasons": dict(sorted(bucket["fallbackReasons"].items())),
        "cpuIdentityInferredActions": bucket["cpuIdentityInferred"],
    }


def aggregate_rows(rows: list[dict[str, Any]], table_columns: set[str], limit_hands: int) -> dict[str, Any]:
    by_variant: dict[str, dict[str, Any]] = defaultdict(init_bucket)
    by_mode: dict[str, dict[str, Any]] = defaultdict(init_bucket)
    by_variant_mode: dict[str, dict[str, Any]] = defaultdict(init_bucket)
    all_actions = init_bucket()
    identity_counts = Counter()
    inferred_count = 0

    for row in rows:
        metadata = row_metadata(row)
        hero_seat = nested_get(metadata, "heroSeat", "hero_seat")
        kind, inferred = player_kind(row, metadata, hero_seat)
        identity_counts[kind] += 1
        if inferred:
            inferred_count += 1
        if kind == "hero":
            continue

        action = normalize_action(row.get("action_type") or row.get("action"))
        hand_id = str(row.get("hand_id") or "")
        variant = safe_variant(row, metadata)
        mode = safe_mode(row, metadata)
        source = decision_source_value(metadata) or "unknown"
        fallback = nested_get(metadata, "fallbackReason", "fallback_reason")
        paid = row.get("paid")
        amount = row.get("amount")
        pot = nested_get(metadata, "pot", "potAfter", "displayedPot")
        if pot is None:
            pot = row.get("pot")

        for bucket in (all_actions, by_variant[variant], by_mode[mode], by_variant_mode[f"{variant}/{mode}"]):
            bucket["actions"] += 1
            if hand_id:
                bucket["hands"].add(hand_id)
            bucket["actionCounts"][action] += 1
            if action in {"call", "bet", "raise"} and not bool(row.get("is_forced")):
                bucket["voluntaryActions"] += 1
            if action in {"bet", "raise"}:
                bucket["raiseOrBet"] += 1
            if action == "showdown":
                bucket["showdowns"] += 1
            if isinstance(pot, (int, float)):
                bucket["potSamples"].append(float(pot))
            elif isinstance(paid, (int, float)) and paid > 0:
                bucket["potSamples"].append(float(paid))
            elif isinstance(amount, (int, float)) and amount > 0:
                bucket["potSamples"].append(float(amount))
            bucket["decisionSources"][str(source)] += 1
            if fallback:
                bucket["fallbackReasons"][str(fallback)] += 1
            if inferred:
                bucket["cpuIdentityInferred"] += 1

    if identity_counts["cpu"] > 0 and inferred_count < identity_counts["cpu"]:
        cpu_identity = "CPU_ID_AVAILABLE"
    elif identity_counts["cpu"] > 0:
        cpu_identity = "CPU_ID_MISSING_BUT_INFERABLE"
    else:
        cpu_identity = "CPU_ID_NOT_AVAILABLE"

    decision_status, decision_fields = has_decision_source(table_columns, rows)
    recent_hand_count = len({str(row.get("hand_id")) for row in rows if row.get("hand_id")})
    return {
        "limitHands": limit_hands,
        "recentHandCount": min(recent_hand_count, limit_hands),
        "rowsRead": len(rows),
        "cpuIdentityAvailability": cpu_identity,
        "identityCounts": dict(identity_counts),
        "decisionSourceAvailability": decision_status,
        "decisionSourceFields": decision_fields,
        "totals": finalize_bucket(all_actions),
        "byVariant": {key: finalize_bucket(value) for key, value in sorted(by_variant.items())},
        "byMode": {key: finalize_bucket(value) for key, value in sorted(by_mode.items())},
        "byVariantMode": {key: finalize_bucket(value) for key, value in sorted(by_variant_mode.items())},
    }


def rows_from_sqlalchemy(db_url: str, limit_hands: int) -> tuple[list[dict[str, Any]], list[TableShape], str]:
    if create_engine is None or inspect is None or text is None:
        return [], [], "sqlalchemy_unavailable"
    engine = create_engine(db_url, future=True)
    with engine.connect() as connection:
        try:
            inspector = inspect(connection)
            table_names = set(inspector.get_table_names())
            shapes = [
                TableShape(name, {column["name"] for column in inspector.get_columns(name)})
                for name in sorted(table_names)
                if name in {"badugi_action_logs", "badugi_hand_actions", "badugi_hand_logs", "badugi_hand_results"}
            ]
        except Exception:
            table_rows = connection.execute(
                text("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()")
            ).fetchall()
            table_names = {str(row[0]) for row in table_rows}
            shapes = []
            for name in sorted(table_names):
                if name not in {"badugi_action_logs", "badugi_hand_actions", "badugi_hand_logs", "badugi_hand_results"}:
                    continue
                column_rows = connection.execute(text(f"SHOW COLUMNS FROM `{name}`")).fetchall()
                shapes.append(TableShape(name, {str(row[0]) for row in column_rows}))
        if "badugi_action_logs" in table_names:
            stmt = text(
                """
                SELECT
                  a.*,
                  h.table_id,
                  h.tournament_id,
                  h.level,
                  h.metadata AS hand_metadata
                FROM badugi_action_logs a
                LEFT JOIN badugi_hand_logs h ON h.hand_id = a.hand_id
                JOIN (
                  SELECT hand_id
                  FROM badugi_action_logs
                  GROUP BY hand_id
                  ORDER BY MAX(ts) DESC
                  LIMIT :limit_hands
                ) recent ON recent.hand_id = a.hand_id
                ORDER BY a.ts ASC, a.seq ASC, a.id ASC
                """
            )
            rows = [dict(row._mapping) for row in connection.execute(stmt, {"limit_hands": limit_hands}).fetchall()]
            return rows, shapes, "badugi_action_logs"
        if "badugi_hand_actions" in table_names and "badugi_hand_logs" in table_names:
            stmt = text(
                """
                SELECT
                  a.id,
                  l.hand_id,
                  l.table_id,
                  l.tournament_id,
                  l.level,
                  l.metadata AS hand_metadata,
                  a.seat_index,
                  a.player_id,
                  a.action,
                  lower(a.action) AS action_type,
                  a.amount,
                  a.round,
                  a.phase,
                  l.created_at,
                  l.metadata AS metadata
                FROM badugi_hand_actions a
                JOIN badugi_hand_logs l ON l.id = a.hand_log_id
                JOIN (
                  SELECT hand_id
                  FROM badugi_hand_logs
                  ORDER BY created_at DESC
                  LIMIT :limit_hands
                ) recent ON recent.hand_id = l.hand_id
                ORDER BY l.created_at ASC, a.id ASC
                """
            )
            rows = [dict(row._mapping) for row in connection.execute(stmt, {"limit_hands": limit_hands}).fetchall()]
            return rows, shapes, "badugi_hand_actions"
        return [], shapes, "no_supported_action_table"


def write_markdown(report: dict[str, Any], path: Path) -> None:
    audit = report.get("audit", {})
    totals = audit.get("totals", {})
    lines = [
        "# MGX Live CPU Action DB Audit",
        "",
        f"- Generated: `{report['generatedAt']}`",
        f"- DB configured: `{report['database']['configured']}`",
        f"- DB dialect: `{report['database']['dialect']}`",
        f"- Source table: `{report.get('sourceTable')}`",
        f"- Recent hands: `{audit.get('recentHandCount', 0)}`",
        f"- CPU identity: `{audit.get('cpuIdentityAvailability', 'unknown')}`",
        f"- Decision source: `{audit.get('decisionSourceAvailability', 'unknown')}`",
        "",
        "## CPU Action Metrics",
        "",
        f"- Actions: `{totals.get('actions', 0)}`",
        f"- Fold rate: `{totals.get('foldRate')}`",
        f"- VPIP proxy: `{totals.get('vpipProxyRate')}`",
        f"- Raise/open count: `{totals.get('raiseOpenCount', 0)}`",
        f"- Call count: `{totals.get('callCount', 0)}`",
        f"- Showdown count: `{totals.get('showdownCount', 0)}`",
        "",
        "## By Variant",
        "",
        "| Variant | Hands | Actions | Fold rate | VPIP proxy | Raise/open | Calls | Showdowns |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for variant, row in (audit.get("byVariant") or {}).items():
        lines.append(
            f"| {variant} | {row.get('hands', 0)} | {row.get('actions', 0)} | {row.get('foldRate')} | "
            f"{row.get('vpipProxyRate')} | {row.get('raiseOpenCount', 0)} | {row.get('callCount', 0)} | "
            f"{row.get('showdownCount', 0)} |"
        )
    lines.extend(
        [
            "",
            "## Comparison",
            "",
            f"- Classification: `{report.get('comparisonClassification')}`",
            f"- Notes: {report.get('comparisonNotes')}",
            "",
            "## Persistence Gaps",
            "",
        ]
    )
    for item in report.get("persistenceGaps", []):
        lines.append(f"- {item}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def classify_comparison(audit: dict[str, Any]) -> tuple[str, str]:
    actions = audit.get("totals", {}).get("actions", 0) or 0
    if actions == 0:
        return "LIVE_DATA_INSUFFICIENT", "No CPU-classified live actions were available to compare."
    fold_rate = audit.get("totals", {}).get("foldRate")
    sources = audit.get("totals", {}).get("decisionSources", {})
    if sources and any(key in sources for key in ("pro-overlay", "rl", "pro")):
        if fold_rate is not None and fold_rate >= 0.9:
            return "LIVE_MATCHES_PRO_OVERLAY", "Live persisted actions are fold-heavy and include RL/pro-overlay source markers."
        return "LIVE_UNKNOWN_SOURCE", "Live source markers include RL/pro-overlay, but fold rate does not match the local fold-heavy pro-overlay pattern."
    if fold_rate is not None and fold_rate < 0.8:
        return "LIVE_MATCHES_HEURISTIC", "Live fold rate is below the local pro-overlay nit pattern and closer to heuristic sanity expectations."
    if audit.get("decisionSourceAvailability") == "DECISION_SOURCE_NOT_PERSISTED":
        return "LIVE_UNKNOWN_SOURCE", "Live action source cannot be confirmed because decisionSource is not persisted."
    return "LIVE_DATA_INSUFFICIENT", "Persisted data is too sparse or ambiguous for a reliable source comparison."


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit-hands", type=int, default=500)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    output = args.output if args.output.is_absolute() else ROOT / args.output
    md_output = output.with_suffix(".md")
    db_url, db_source = discover_db_url()
    database = masked_db_kind(db_url, db_source)
    rows: list[dict[str, Any]] = []
    shapes: list[TableShape] = []
    source_table = None
    errors: list[str] = []

    if db_url:
        try:
            rows, shapes, source_table = rows_from_sqlalchemy(db_url, max(1, args.limit_hands))
        except (SQLAlchemyError, sqlite3.Error, OSError, RuntimeError) as exc:
            errors.append(type(exc).__name__)
            source_table = "connection_failed"
    else:
        source_table = "not_configured"

    table_columns = set()
    for shape in shapes:
        table_columns |= shape.columns
    audit = aggregate_rows(rows, table_columns, max(1, args.limit_hands))
    comparison, comparison_notes = classify_comparison(audit)
    gaps: list[str] = []
    if audit["cpuIdentityAvailability"] != "CPU_ID_AVAILABLE":
        gaps.append("CPU identity is not explicitly persisted; audit uses inference when possible.")
    if audit["decisionSourceAvailability"] != "DECISION_SOURCE_AVAILABLE":
        gaps.append("decisionSource/fallbackReason/legalActions are not reliably persisted in DB action rows.")
    if not rows:
        gaps.append("No recent supported action rows were readable from the configured DB.")

    report = {
        "generatedAt": now_iso(),
        "readOnly": True,
        "piiMasked": True,
        "tokenExposed": False,
        "database": database,
        "sourceTable": source_table,
        "tablesInspected": [{"name": shape.name, "columns": sorted(shape.columns)} for shape in shapes],
        "audit": audit,
        "comparisonClassification": comparison,
        "comparisonNotes": comparison_notes,
        "persistenceGaps": gaps,
        "errors": errors,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
    write_markdown(report, md_output)
    print(
        json.dumps(
            {
                "output": str(output.relative_to(ROOT)),
                "markdown": str(md_output.relative_to(ROOT)),
                "sourceTable": source_table,
                "recentHandCount": audit["recentHandCount"],
                "cpuIdentityAvailability": audit["cpuIdentityAvailability"],
                "decisionSourceAvailability": audit["decisionSourceAvailability"],
                "comparison": comparison,
                "tokenExposed": False,
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
