"""
Impact / sustainability engine. Every number here is derived from real
rows in the `allocations` table (created only when a user accepts a
recommended match) plus a live snapshot of current inventory/demand -
nothing is a fake incrementing counter.
"""
from services.waste import get_inventory_with_risk


def get_impact(conn) -> dict:
    totals = conn.execute(
        """
        SELECT
            COALESCE(SUM(quantity), 0) AS redistributed,
            COALESCE(SUM(CASE WHEN rescued = 1 THEN quantity ELSE 0 END), 0) AS rescued,
            COALESCE(SUM(distance_avoided_km), 0) AS distance_avoided,
            COALESCE(SUM(co2_avoided_kg), 0) AS co2_avoided,
            COUNT(*) AS allocation_count
        FROM allocations WHERE status = 'accepted'
        """
    ).fetchone()

    available_today = conn.execute(
        "SELECT COALESCE(SUM(quantity), 0) AS q FROM inventory WHERE status = 'available'"
    ).fetchone()["q"]

    allocated_total = totals["redistributed"]

    unmet_demand = conn.execute(
        "SELECT COALESCE(SUM(quantity - quantity_received), 0) AS q FROM demand WHERE status = 'open'"
    ).fetchone()["q"]

    at_risk_items = [i for i in get_inventory_with_risk(conn) if i["waste_risk"] in ("CRITICAL", "HIGH")]
    at_risk_qty = sum(i["quantity"] for i in at_risk_items)

    return {
        "food_available_today": round(available_today, 1),
        "food_allocated": round(allocated_total, 1),
        "food_redistributed": round(totals["redistributed"], 1),
        "food_rescued": round(totals["rescued"], 1),
        "distance_avoided_km": round(totals["distance_avoided"], 1),
        "co2_avoided_kg": round(totals["co2_avoided"], 1),
        "unmet_demand": round(unmet_demand, 1),
        "at_risk_of_waste": round(at_risk_qty, 1),
        "allocation_count": totals["allocation_count"],
    }
