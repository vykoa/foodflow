"""
FOODFLOW SIGNALS - converts raw supply/demand rows into surplus and
shortage alerts, per food item. Deterministic aggregation, no ML.
"""
from services.simulation import get_disabled_owner_id


def get_signals(conn) -> dict:
    disabled_owner = get_disabled_owner_id(conn)

    supply_rows = conn.execute(
        "SELECT food_item, owner_id, quantity FROM inventory WHERE status = 'available' AND quantity > 0"
    ).fetchall()
    supply_by_item = {}
    for r in supply_rows:
        if disabled_owner and r["owner_id"] == disabled_owner:
            continue
        supply_by_item[r["food_item"]] = supply_by_item.get(r["food_item"], 0) + r["quantity"]

    demand_rows = conn.execute(
        "SELECT food_item, quantity, quantity_received FROM demand WHERE status = 'open'"
    ).fetchall()
    demand_by_item = {}
    for r in demand_rows:
        remaining = max(r["quantity"] - r["quantity_received"], 0)
        demand_by_item[r["food_item"]] = demand_by_item.get(r["food_item"], 0) + remaining

    items = set(supply_by_item) | set(demand_by_item)
    surplus, shortage = [], []
    for item in items:
        supply = round(supply_by_item.get(item, 0), 1)
        demand = round(demand_by_item.get(item, 0), 1)
        diff = round(supply - demand, 1)
        if diff > 0.5:
            surplus.append(
                {
                    "food_item": item,
                    "supply": supply,
                    "matched_demand": min(supply, demand),
                    "unallocated": diff,
                }
            )
        elif diff < -0.5:
            shortage.append(
                {
                    "food_item": item,
                    "demand": demand,
                    "covered_by_supply": min(supply, demand),
                    "shortfall": round(-diff, 1),
                }
            )

    surplus.sort(key=lambda x: -x["unallocated"])
    shortage.sort(key=lambda x: -x["shortfall"])
    return {"surplus": surplus, "shortage": shortage}
