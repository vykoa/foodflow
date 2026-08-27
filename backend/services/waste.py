"""
Waste engine: turns "shelf_life_hours + expiry_at" into a human risk
level, relative to the simulation clock (see services/simulation.py).

Thresholds are intentionally simple and visible (not learned):
  <= 0h    -> EXPIRED
  <= 24h   -> CRITICAL
  <= 72h   -> HIGH
  <= 168h  -> MEDIUM
  else     -> LOW
"""
from datetime import datetime

from services.simulation import get_sim_now, get_disabled_owner_id

CRITICAL_HOURS = 24
HIGH_HOURS = 72
MEDIUM_HOURS = 168


def hours_remaining(expiry_at: str, sim_now: datetime) -> float:
    return (datetime.fromisoformat(expiry_at) - sim_now).total_seconds() / 3600


def risk_level(hours_left: float) -> str:
    if hours_left <= 0:
        return "EXPIRED"
    if hours_left <= CRITICAL_HOURS:
        return "CRITICAL"
    if hours_left <= HIGH_HOURS:
        return "HIGH"
    if hours_left <= MEDIUM_HOURS:
        return "MEDIUM"
    return "LOW"


def format_hours(hours_left: float) -> str:
    if hours_left <= 0:
        return "expired"
    h = int(hours_left)
    m = int(round((hours_left - h) * 60))
    if h >= 24:
        d = h // 24
        rem_h = h % 24
        return f"{d}d {rem_h}h"
    return f"{h}h {m}m"


def get_inventory_with_risk(conn, owner_id=None, include_offline=False):
    """Every inventory row annotated with waste-risk and reservation fields."""
    # Lazy import: services/transactions.py imports this module at load
    # time, so this module must not import it back at load time too.
    from services.transactions import reserved_quantity

    sim_now = get_sim_now(conn)
    disabled_owner = get_disabled_owner_id(conn)
    query = """
        SELECT i.*, u.name AS owner_name, u.role AS owner_role,
               l.name AS location_name, l.lat AS lat, l.lng AS lng
        FROM inventory i
        JOIN users u ON i.owner_id = u.id
        JOIN locations l ON i.location_id = l.id
    """
    params = []
    if owner_id is not None:
        query += " WHERE i.owner_id = ?"
        params.append(owner_id)
    rows = conn.execute(query, params).fetchall()

    result = []
    for r in rows:
        d = dict(r)
        hl = hours_remaining(d["expiry_at"], sim_now)
        d["hours_remaining"] = round(hl, 1)
        d["time_remaining_label"] = format_hours(hl)
        d["waste_risk"] = risk_level(hl)
        d["is_offline"] = disabled_owner is not None and d["owner_id"] == disabled_owner
        reserved = reserved_quantity(conn, d["id"])
        d["reserved_qty"] = reserved
        d["available_qty"] = max(round(d["quantity"] - reserved, 2), 0)
        if not include_offline and d["is_offline"]:
            continue
        result.append(d)
    return result


def get_waste_watch(conn, top_n_destinations=3):
    """
    High-risk inventory (CRITICAL/HIGH) with ranked rescue destinations.
    Imported lazily to avoid a circular import with matching.py.
    """
    from services.matching import rank_destinations_for_inventory

    items = get_inventory_with_risk(conn)
    at_risk = [i for i in items if i["waste_risk"] in ("CRITICAL", "HIGH") and i["available_qty"] > 0]
    at_risk.sort(key=lambda x: x["hours_remaining"])

    watch = []
    for item in at_risk:
        destinations = rank_destinations_for_inventory(conn, item["id"], top_n=top_n_destinations)
        watch.append({**item, "destinations": destinations})
    return watch
