"""
The transaction pipeline - the connective tissue of FOODFLOW.

A "transaction" (stored in the `allocations` table) is one reserved
quantity of one inventory item travelling from a producer to a buyer,
optionally via a distributor:

    distributor_needed -> distributor_assigned -> picked_up -> delivered

Quantity is only RESERVED against the inventory row until 'delivered' -
`available_quantity()` is what every other part of the app (matching,
marketplace listings, waste risk) should treat as "free to request".
Only 'delivered' physically moves stock: inventory.quantity decreases
and demand.quantity_received increases at that moment, not before.
"""
import json
from datetime import datetime

from services.waste import hours_remaining, risk_level
from services.simulation import get_sim_now

STATUSES = ["distributor_needed", "distributor_assigned", "picked_up", "delivered"]

STATUS_LABELS = {
    "distributor_needed": "Awaiting distribution",
    "distributor_assigned": "Distributor assigned",
    "picked_up": "Picked up",
    "delivered": "Delivered",
}

# The five-stage visual progress indicator (spec section 7). "Request"
# and "Match" are both already true the instant a transaction exists,
# since it was only ever created against an already-scored match.
PROGRESS_STAGES = ["Request", "Match", "Distributor", "Pickup", "Delivered"]

_STAGE_INDEX = {
    "distributor_needed": 2,   # Request, Match done; Distributor active
    "distributor_assigned": 3,  # + Distributor done; Pickup active
    "picked_up": 4,             # + Pickup done; Delivered active
    "delivered": 5,             # all done
}


def progress(status: str) -> list[dict]:
    done_count = _STAGE_INDEX.get(status, 0)
    stages = []
    for i, label in enumerate(PROGRESS_STAGES):
        if i < done_count:
            state = "done"
        elif i == done_count:
            state = "active"
        else:
            state = "pending"
        stages.append({"label": label, "state": state})
    return stages


def reserved_quantity(conn, inventory_id: int, exclude_id: int | None = None) -> float:
    """Quantity of this inventory item tied up in any non-delivered transaction."""
    q = """
        SELECT COALESCE(SUM(quantity), 0) AS q FROM allocations
        WHERE inventory_id = ? AND status != 'delivered'
    """
    params = [inventory_id]
    if exclude_id is not None:
        q += " AND id != ?"
        params.append(exclude_id)
    return conn.execute(q, params).fetchone()["q"]


def available_quantity(conn, inventory_row) -> float:
    """What's actually free to request right now - raw stock minus reservations."""
    reserved = reserved_quantity(conn, inventory_row["id"])
    return max(round(inventory_row["quantity"] - reserved, 2), 0)


def _row_to_dict(conn, row, sim_now=None) -> dict:
    sim_now = sim_now or get_sim_now(conn)
    d = dict(row)
    d["score_breakdown"] = json.loads(d["score_breakdown"]) if d["score_breakdown"] else {}
    d["status_label"] = STATUS_LABELS.get(d["status"], d["status"])
    d["progress"] = progress(d["status"])
    hl = hours_remaining(d["inv_expiry_at"], sim_now)
    d["inventory_hours_remaining"] = round(hl, 1)
    d["inventory_waste_risk"] = risk_level(hl)
    return d


TRANSACTION_QUERY = """
    SELECT
        a.*,
        i.food_item AS food_item, i.unit AS unit, i.expiry_at AS inv_expiry_at,
        i.quantity AS inventory_total_quantity, i.owner_id AS producer_id,
        pu.name AS producer_name, pl.name AS producer_location,
        d.quantity AS demand_quantity, d.priority AS demand_priority,
        d.requester_id AS buyer_id, bu.name AS buyer_name, bl.name AS buyer_location,
        du.name AS distributor_name
    FROM allocations a
    JOIN inventory i ON a.inventory_id = i.id
    JOIN users pu ON i.owner_id = pu.id
    JOIN locations pl ON i.location_id = pl.id
    JOIN demand d ON a.demand_id = d.id
    JOIN users bu ON d.requester_id = bu.id
    JOIN locations bl ON d.location_id = bl.id
    LEFT JOIN users du ON a.distributor_id = du.id
"""


def list_transactions(conn, status=None, producer_id=None, buyer_id=None, distributor_id=None,
                       unassigned_only=False) -> list[dict]:
    q = TRANSACTION_QUERY + " WHERE 1=1"
    params = []
    if status:
        q += " AND a.status = ?"
        params.append(status)
    if producer_id:
        q += " AND i.owner_id = ?"
        params.append(producer_id)
    if buyer_id:
        q += " AND d.requester_id = ?"
        params.append(buyer_id)
    if distributor_id:
        q += " AND a.distributor_id = ?"
        params.append(distributor_id)
    if unassigned_only:
        q += " AND a.distributor_id IS NULL"
    q += " ORDER BY a.id DESC"
    rows = conn.execute(q, params).fetchall()
    sim_now = get_sim_now(conn)
    return [_row_to_dict(conn, r, sim_now) for r in rows]


def get_transaction(conn, tx_id: int) -> dict | None:
    row = conn.execute(TRANSACTION_QUERY + " WHERE a.id = ?", (tx_id,)).fetchone()
    return _row_to_dict(conn, row) if row else None


def assign_distributor(conn, tx_id: int, distributor_id: int, sim_now) -> dict:
    tx = conn.execute("SELECT * FROM allocations WHERE id = ?", (tx_id,)).fetchone()
    if not tx:
        raise ValueError("Transaction not found")
    if tx["status"] != "distributor_needed":
        raise ValueError(f"This move is already {STATUS_LABELS.get(tx['status'], tx['status']).lower()}.")
    conn.execute(
        "UPDATE allocations SET status = 'distributor_assigned', distributor_id = ?, assigned_at = ? WHERE id = ?",
        (distributor_id, sim_now.isoformat(), tx_id),
    )
    return get_transaction(conn, tx_id)


def decline_assignment(conn, tx_id: int) -> dict:
    tx = conn.execute("SELECT * FROM allocations WHERE id = ?", (tx_id,)).fetchone()
    if not tx:
        raise ValueError("Transaction not found")
    if tx["status"] != "distributor_assigned":
        raise ValueError("Only an assigned move can be declined.")
    conn.execute(
        "UPDATE allocations SET status = 'distributor_needed', distributor_id = NULL, assigned_at = NULL WHERE id = ?",
        (tx_id,),
    )
    return get_transaction(conn, tx_id)


def mark_picked_up(conn, tx_id: int, sim_now) -> dict:
    tx = conn.execute("SELECT * FROM allocations WHERE id = ?", (tx_id,)).fetchone()
    if not tx:
        raise ValueError("Transaction not found")
    if tx["status"] != "distributor_assigned":
        raise ValueError("Only an assigned move can be marked picked up.")
    conn.execute(
        "UPDATE allocations SET status = 'picked_up', picked_up_at = ? WHERE id = ?",
        (sim_now.isoformat(), tx_id),
    )
    return get_transaction(conn, tx_id)


def mark_delivered(conn, tx_id: int, sim_now) -> dict:
    """The one moment real stock and real demand actually move."""
    tx = conn.execute("SELECT * FROM allocations WHERE id = ?", (tx_id,)).fetchone()
    if not tx:
        raise ValueError("Transaction not found")
    if tx["status"] != "picked_up":
        raise ValueError("Only a picked-up move can be marked delivered.")

    inv = conn.execute("SELECT * FROM inventory WHERE id = ?", (tx["inventory_id"],)).fetchone()
    dem = conn.execute("SELECT * FROM demand WHERE id = ?", (tx["demand_id"],)).fetchone()

    new_inv_qty = round(inv["quantity"] - tx["quantity"], 2)
    new_inv_status = "depleted" if new_inv_qty <= 0.01 else inv["status"]
    conn.execute("UPDATE inventory SET quantity = ?, status = ? WHERE id = ?",
                 (max(new_inv_qty, 0), new_inv_status, inv["id"]))

    new_received = round(dem["quantity_received"] + tx["quantity"], 2)
    new_dem_status = "fulfilled" if new_received >= dem["quantity"] - 0.01 else dem["status"]
    conn.execute("UPDATE demand SET quantity_received = ?, status = ? WHERE id = ?",
                 (new_received, new_dem_status, dem["id"]))

    conn.execute(
        "UPDATE allocations SET status = 'delivered', delivered_at = ? WHERE id = ?",
        (sim_now.isoformat(), tx_id),
    )
    return get_transaction(conn, tx_id)
