"""
The matching engine - the intellectual heart of FOODFLOW.

Deterministic, explainable, and easy to tune: every supply/demand pair
gets a 0-100 match score built from six weighted, human-readable
factors. Nothing here is a black box - `explain_match()` returns the
exact same numbers the score was built from.
"""
import math
from datetime import datetime

from services.simulation import get_sim_now, get_disabled_owner_id, get_delayed_location_id
from services.waste import hours_remaining, risk_level

# ---- Tunable weights (sum to 1.0) --------------------------------------
WEIGHTS = {
    "urgency": 0.25,
    "shelf_life": 0.25,
    "proximity": 0.20,
    "quantity_fit": 0.15,
    "priority": 0.10,
    "transport_efficiency": 0.05,
}

PRIORITY_SCORE = {"CRITICAL": 100, "HIGH": 75, "NORMAL": 50, "LOW": 25}
TRUCK_CAPACITY_KG = 500          # assumed kg per single trip
CO2_PER_KM_PER_TRIP = 0.12       # kg CO2 per km per trip (small delivery vehicle, estimate)
TRANSPORT_DELAY_MULTIPLIER = 2.5


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _clamp(x, lo=0, hi=100):
    return max(lo, min(hi, x))


def score_urgency(hours_until_needed: float) -> float:
    """Sooner needed-by -> higher urgency. Linear decay over 7 days."""
    if hours_until_needed <= 0:
        return 100.0
    if hours_until_needed >= 168:
        return 10.0
    return round(100 - (hours_until_needed / 168) * 90, 1)


def score_shelf_life(hours_left: float) -> float:
    """Less remaining shelf life -> higher score (more important to move now)."""
    if hours_left <= 0:
        return 100.0
    return round(max(5.0, 100 * math.exp(-hours_left / 72)), 1)


def score_proximity(distance_km: float) -> float:
    return round(_clamp(100 - distance_km * 4), 1)


def score_quantity_fit(supply_qty: float, demand_qty: float) -> float:
    if supply_qty <= 0 or demand_qty <= 0:
        return 0.0
    ratio = min(supply_qty, demand_qty) / max(supply_qty, demand_qty)
    return round(ratio * 100, 1)


def score_priority(priority: str) -> float:
    return PRIORITY_SCORE.get(priority, 50)


def score_transport_efficiency(distance_km: float, quantity: float) -> float:
    trips = max(1, math.ceil(quantity / TRUCK_CAPACITY_KG))
    cost = distance_km * trips
    return round(_clamp(100 - cost * 1.5), 1)


def estimate_transport(distance_km: float, quantity: float) -> dict:
    trips = max(1, math.ceil(quantity / TRUCK_CAPACITY_KG))
    co2 = round(distance_km * trips * CO2_PER_KM_PER_TRIP, 2)
    return {"distance_km": round(distance_km, 1), "estimated_trips": trips, "estimated_co2": co2}


def _score_pair(conn, inventory_row, demand_row, sim_now, delayed_location_id):
    inv_loc = (inventory_row["lat"], inventory_row["lng"])
    dem_loc = (demand_row["lat"], demand_row["lng"])
    distance = haversine_km(inv_loc[0], inv_loc[1], dem_loc[0], dem_loc[1])
    delayed = delayed_location_id is not None and (
        inventory_row["location_id"] == delayed_location_id
        or demand_row["location_id"] == delayed_location_id
    )
    if delayed:
        distance *= TRANSPORT_DELAY_MULTIPLIER

    hours_left = hours_remaining(inventory_row["expiry_at"], sim_now)
    hours_until_needed = (datetime.fromisoformat(demand_row["needed_by"]) - sim_now).total_seconds() / 3600
    remaining_demand = max(demand_row["quantity"] - demand_row["quantity_received"], 0)
    quantity = round(min(inventory_row["quantity"], remaining_demand), 1)

    components = {
        "urgency": score_urgency(hours_until_needed),
        "shelf_life": score_shelf_life(hours_left),
        "proximity": score_proximity(distance),
        "quantity_fit": score_quantity_fit(inventory_row["quantity"], remaining_demand),
        "priority": score_priority(demand_row["priority"]),
        "transport_efficiency": score_transport_efficiency(distance, quantity),
    }
    weighted = {k: round(v * WEIGHTS[k], 1) for k, v in components.items()}
    total_score = round(sum(weighted.values()))

    return {
        "id": f"{inventory_row['id']}:{demand_row['id']}",
        "inventory_id": inventory_row["id"],
        "demand_id": demand_row["id"],
        "food_item": inventory_row["food_item"],
        "supplier_name": inventory_row["owner_name"],
        "supplier_location": inventory_row["location_name"],
        "requester_name": demand_row["requester_name"],
        "requester_location": demand_row["location_name"],
        "quantity": quantity,
        "distance_km": round(distance, 1),
        "delayed_route": delayed,
        "waste_risk": risk_level(hours_left),
        "hours_left": round(hours_left, 1),
        "priority": demand_row["priority"],
        "match_score": total_score,
        "score_breakdown": components,
        "weighted_breakdown": weighted,
        "transport": estimate_transport(distance, quantity),
    }


def _fetch_inventory(conn, food_item=None, exclude_owner_id=None):
    q = """
        SELECT i.*, u.name AS owner_name, l.name AS location_name, l.lat AS lat, l.lng AS lng
        FROM inventory i
        JOIN users u ON i.owner_id = u.id
        JOIN locations l ON i.location_id = l.id
        WHERE i.status = 'available' AND i.quantity > 0
    """
    params = []
    if food_item:
        q += " AND LOWER(i.food_item) = LOWER(?)"
        params.append(food_item)
    if exclude_owner_id:
        q += " AND i.owner_id != ?"
        params.append(exclude_owner_id)
    return conn.execute(q, params).fetchall()


def _fetch_demand(conn, food_item=None, demand_id=None):
    q = """
        SELECT d.*, u.name AS requester_name, l.name AS location_name, l.lat AS lat, l.lng AS lng
        FROM demand d
        JOIN users u ON d.requester_id = u.id
        JOIN locations l ON d.location_id = l.id
        WHERE d.status = 'open' AND (d.quantity - d.quantity_received) > 0
    """
    params = []
    if food_item:
        q += " AND LOWER(d.food_item) = LOWER(?)"
        params.append(food_item)
    if demand_id:
        q += " AND d.id = ?"
        params.append(demand_id)
    return conn.execute(q, params).fetchall()


def _rejected_pairs(conn):
    rows = conn.execute("SELECT inventory_id, demand_id FROM rejected_matches").fetchall()
    return {(r["inventory_id"], r["demand_id"]) for r in rows}


def compute_matches(conn, demand_id=None, food_item=None, top_n=20):
    """Rank supply/demand pairs across the whole network."""
    sim_now = get_sim_now(conn)
    disabled_owner = get_disabled_owner_id(conn)
    delayed_location = get_delayed_location_id(conn)
    rejected = _rejected_pairs(conn)

    demand_rows = _fetch_demand(conn, food_item=food_item, demand_id=demand_id)
    matches = []
    for dem in demand_rows:
        inv_rows = _fetch_inventory(conn, food_item=dem["food_item"], exclude_owner_id=None)
        for inv in inv_rows:
            if disabled_owner and inv["owner_id"] == disabled_owner:
                continue
            if (inv["id"], dem["id"]) in rejected:
                continue
            # expired food can never be matched
            if hours_remaining(inv["expiry_at"], sim_now) <= 0:
                continue
            matches.append(_score_pair(conn, inv, dem, sim_now, delayed_location))

    matches.sort(key=lambda m: -m["match_score"])
    return matches[:top_n]


def rank_destinations_for_inventory(conn, inventory_id, top_n=3):
    """Used by the Waste Watch / Food Rescue engine: given one at-risk
    inventory item, rank the demand destinations that should receive it."""
    sim_now = get_sim_now(conn)
    delayed_location = get_delayed_location_id(conn)
    rejected = _rejected_pairs(conn)

    inv = conn.execute(
        """
        SELECT i.*, u.name AS owner_name, l.name AS location_name, l.lat AS lat, l.lng AS lng
        FROM inventory i JOIN users u ON i.owner_id = u.id JOIN locations l ON i.location_id = l.id
        WHERE i.id = ?
        """,
        (inventory_id,),
    ).fetchone()
    if not inv:
        return []

    demand_rows = _fetch_demand(conn, food_item=inv["food_item"])
    ranked = []
    for dem in demand_rows:
        if (inv["id"], dem["id"]) in rejected:
            continue
        ranked.append(_score_pair(conn, inv, dem, sim_now, delayed_location))
    ranked.sort(key=lambda m: -m["match_score"])
    return ranked[:top_n]


def explain_match(match: dict) -> list[str]:
    """Human-readable bullet explanation for '[ WHY THIS MATCH? ]'."""
    c = match["score_breakdown"]
    bullets = []
    if c["urgency"] >= 70:
        bullets.append("High demand urgency")
    elif c["urgency"] >= 40:
        bullets.append("Moderate demand urgency")
    if c["shelf_life"] >= 70:
        bullets.append("Food approaching expiry")
    if c["proximity"] >= 70:
        bullets.append("Nearby destination")
    elif c["proximity"] < 30:
        bullets.append("Longer-distance route")
    if c["quantity_fit"] >= 70:
        bullets.append("Good quantity match")
    if c["priority"] >= 75:
        bullets.append("High-priority destination")
    if c["transport_efficiency"] >= 60:
        bullets.append("Efficient transport")
    if match.get("delayed_route"):
        bullets.append("Route currently delayed (what-if scenario active)")
    return bullets
