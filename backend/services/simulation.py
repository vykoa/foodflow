"""
Simulation clock + "What If?" resilience scenarios.

FOODFLOW never relies on wall-clock time for its demo: every perishable
item's expiry is compared against a *simulated* current time. That time
is `anchor_time + clock_offset_hours`, both stored in the `settings`
table. Moving the demo clock only changes `clock_offset_hours` - but
because every waste/match/impact calculation reads that value fresh,
the whole application recomputes for real.

Scenario application mutates real rows (inventory / demand) and keeps a
JSON backup of what it changed, so "NORMAL" can restore the baseline.
"""
import json
from datetime import datetime, timedelta

ANCHOR_KEY = "anchor_time"
OFFSET_KEY = "clock_offset_hours"
SCENARIO_KEY = "active_scenario"
BACKUP_KEY = "scenario_backup"
DISABLED_OWNER_KEY = "disabled_owner_id"
DELAYED_LOCATION_KEY = "delayed_location_id"

TRANSPORT_DELAY_MULTIPLIER = 2.5


def _get_setting(conn, key, default=None):
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def _set_setting(conn, key, value):
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )


def _clear_setting(conn, key):
    conn.execute("DELETE FROM settings WHERE key = ?", (key,))


def ensure_anchor(conn, anchor: datetime | None = None):
    """Set the anchor time once (seed time) if it isn't already set."""
    if _get_setting(conn, ANCHOR_KEY) is None:
        _set_setting(conn, ANCHOR_KEY, (anchor or datetime.utcnow()).isoformat())
        _set_setting(conn, OFFSET_KEY, "0")
        conn.commit()


def get_sim_now(conn) -> datetime:
    anchor = datetime.fromisoformat(_get_setting(conn, ANCHOR_KEY, datetime.utcnow().isoformat()))
    offset = float(_get_setting(conn, OFFSET_KEY, "0"))
    return anchor + timedelta(hours=offset)


def get_clock_state(conn) -> dict:
    return {
        "anchor_time": _get_setting(conn, ANCHOR_KEY),
        "offset_hours": float(_get_setting(conn, OFFSET_KEY, "0")),
        "sim_now": get_sim_now(conn).isoformat(),
        "active_scenario": _get_setting(conn, SCENARIO_KEY, "normal"),
    }


def shift_clock(conn, hours: float | None = None, reset: bool = False):
    if reset:
        _set_setting(conn, OFFSET_KEY, "0")
    else:
        current = float(_get_setting(conn, OFFSET_KEY, "0"))
        _set_setting(conn, OFFSET_KEY, str(current + (hours or 0)))
    conn.commit()
    return get_clock_state(conn)


def get_disabled_owner_id(conn):
    val = _get_setting(conn, DISABLED_OWNER_KEY)
    return int(val) if val else None


def get_delayed_location_id(conn):
    val = _get_setting(conn, DELAYED_LOCATION_KEY)
    return int(val) if val else None


def _log_event(conn, message, type_="scenario"):
    conn.execute(
        "INSERT INTO events (timestamp, message, type) VALUES (?, ?, ?)",
        (get_sim_now(conn).isoformat(), message, type_),
    )


def apply_scenario(conn, scenario: str) -> dict:
    scenario = scenario.lower()
    if scenario == "normal":
        return _revert_scenarios(conn)
    if scenario == "supply_shock":
        return _supply_shock(conn)
    if scenario == "transport_delay":
        return _transport_delay(conn)
    if scenario == "demand_surge":
        return _demand_surge(conn)
    if scenario == "food_spoilage":
        return _food_spoilage(conn)
    raise ValueError(f"Unknown scenario: {scenario}")


def _revert_scenarios(conn):
    backup_raw = _get_setting(conn, BACKUP_KEY)
    if backup_raw:
        backup = json.loads(backup_raw)
        for inv in backup.get("inventory", []):
            conn.execute(
                "UPDATE inventory SET expiry_at = ?, status = ? WHERE id = ?",
                (inv["expiry_at"], inv["status"], inv["id"]),
            )
        for dem in backup.get("demand", []):
            conn.execute(
                "UPDATE demand SET quantity = ? WHERE id = ?",
                (dem["quantity"], dem["id"]),
            )
    _clear_setting(conn, DISABLED_OWNER_KEY)
    _clear_setting(conn, DELAYED_LOCATION_KEY)
    _clear_setting(conn, BACKUP_KEY)
    _set_setting(conn, SCENARIO_KEY, "normal")
    _log_event(conn, "Resilience scenario reset to NORMAL. All disruptions reverted.")
    conn.commit()
    return {"scenario": "normal", "message": "Baseline restored."}


def _supply_shock(conn):
    # Take the producer/supplier with the most available inventory offline.
    row = conn.execute(
        """
        SELECT u.id AS owner_id, u.name AS owner_name, SUM(i.quantity) AS total_qty
        FROM inventory i JOIN users u ON i.owner_id = u.id
        WHERE i.status = 'available'
        GROUP BY u.id ORDER BY total_qty DESC LIMIT 1
        """
    ).fetchone()
    if not row:
        return {"scenario": "supply_shock", "message": "No supplier available to disrupt."}
    owner_id = row["owner_id"]
    affected_items = conn.execute(
        "SELECT id, food_item, quantity FROM inventory WHERE owner_id = ? AND status = 'available'",
        (owner_id,),
    ).fetchall()
    _set_setting(conn, DISABLED_OWNER_KEY, str(owner_id))
    _set_setting(conn, SCENARIO_KEY, "supply_shock")
    total = sum(i["quantity"] for i in affected_items)
    _log_event(
        conn,
        f"SUPPLY SHOCK: {row['owner_name']} has gone offline. "
        f"{total:.0f} kg of supply across {len(affected_items)} item(s) is now unavailable.",
    )
    conn.commit()
    return {
        "scenario": "supply_shock",
        "affected_owner": row["owner_name"],
        "affected_quantity": total,
        "message": f"{row['owner_name']} is offline. Recalculating matches for affected demand.",
    }


def _transport_delay(conn):
    # Pick the location most central to existing supply (flag it as delayed).
    row = conn.execute(
        """
        SELECT l.id AS location_id, l.name AS location_name, COUNT(*) AS n
        FROM inventory i JOIN locations l ON i.location_id = l.id
        WHERE i.status = 'available'
        GROUP BY l.id ORDER BY n DESC LIMIT 1
        """
    ).fetchone()
    if not row:
        return {"scenario": "transport_delay", "message": "No route available to delay."}
    _set_setting(conn, DELAYED_LOCATION_KEY, str(row["location_id"]))
    _set_setting(conn, SCENARIO_KEY, "transport_delay")
    _log_event(
        conn,
        f"TRANSPORT DELAY: routes via {row['location_name']} are now slower/costlier "
        f"(distance penalty x{TRANSPORT_DELAY_MULTIPLIER}). Recalculating transport impact.",
    )
    conn.commit()
    return {
        "scenario": "transport_delay",
        "affected_location": row["location_name"],
        "message": f"Routes through {row['location_name']} are delayed. Alternatives are being ranked.",
    }


def _demand_surge(conn):
    row = conn.execute(
        """
        SELECT d.id, d.food_item, d.quantity, u.name AS requester_name
        FROM demand d JOIN users u ON d.requester_id = u.id
        WHERE d.status = 'open' ORDER BY d.quantity DESC LIMIT 1
        """
    ).fetchone()
    if not row:
        return {"scenario": "demand_surge", "message": "No open demand to surge."}
    backup = json.loads(_get_setting(conn, BACKUP_KEY, "{}") or "{}")
    backup.setdefault("demand", [])
    if not any(d["id"] == row["id"] for d in backup["demand"]):
        backup["demand"].append({"id": row["id"], "quantity": row["quantity"]})
    _set_setting(conn, BACKUP_KEY, json.dumps(backup))
    new_qty = round(row["quantity"] * 1.8, 1)
    conn.execute("UPDATE demand SET quantity = ? WHERE id = ?", (new_qty, row["id"]))
    _set_setting(conn, SCENARIO_KEY, "demand_surge")
    _log_event(
        conn,
        f"DEMAND SURGE: {row['requester_name']} increased {row['food_item']} demand from "
        f"{row['quantity']:.0f} kg to {new_qty:.0f} kg. Searching for alternative supply.",
    )
    conn.commit()
    return {
        "scenario": "demand_surge",
        "requester": row["requester_name"],
        "food_item": row["food_item"],
        "old_quantity": row["quantity"],
        "new_quantity": new_qty,
        "message": f"{row['requester_name']}'s {row['food_item']} demand surged to {new_qty:.0f} kg.",
    }


def _food_spoilage(conn):
    # Advance perishability on 1-2 items currently rated LOW/MEDIUM risk.
    sim_now = get_sim_now(conn)
    rows = conn.execute(
        "SELECT id, food_item, expiry_at, status FROM inventory WHERE status = 'available'"
    ).fetchall()
    candidates = []
    for r in rows:
        hours_left = (datetime.fromisoformat(r["expiry_at"]) - sim_now).total_seconds() / 3600
        if hours_left > 24:
            candidates.append((hours_left, r))
    candidates.sort(key=lambda x: -x[0])
    targets = [r for _, r in candidates[:2]]
    if not targets:
        return {"scenario": "food_spoilage", "message": "No stable inventory left to spoil."}
    backup = json.loads(_get_setting(conn, BACKUP_KEY, "{}") or "{}")
    backup.setdefault("inventory", [])
    new_expiry = (sim_now + timedelta(hours=6)).isoformat()
    names = []
    for r in targets:
        if not any(i["id"] == r["id"] for i in backup["inventory"]):
            backup["inventory"].append(
                {"id": r["id"], "expiry_at": r["expiry_at"], "status": r["status"]}
            )
        conn.execute("UPDATE inventory SET expiry_at = ? WHERE id = ?", (new_expiry, r["id"]))
        names.append(r["food_item"])
    unique_names = sorted(set(names))
    _set_setting(conn, BACKUP_KEY, json.dumps(backup))
    _set_setting(conn, SCENARIO_KEY, "food_spoilage")
    _log_event(
        conn,
        f"FOOD SPOILAGE: {', '.join(unique_names)} is spoiling faster than expected "
        f"(now ~6h from expiry). Rescue priority raised.",
    )
    conn.commit()
    return {
        "scenario": "food_spoilage",
        "affected_items": unique_names,
        "message": f"{', '.join(names)} now critically close to expiry.",
    }
