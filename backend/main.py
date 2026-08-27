"""
FOODFLOW backend - FastAPI app.

One source of truth: every endpoint reads/writes the same SQLite
database. Nothing here is a per-view hardcoded fixture - accepting an
allocation updates inventory, demand, allocations, transport and the
event feed in a single transaction, so every screen that reads from
the DB reflects it immediately.
"""
import json
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware

from database import get_db, init_schema, get_connection
from schemas import (
    InventoryCreate, InventoryUpdate, DemandCreate, DemandUpdate,
    AcceptMatchBody, ClockBody, RequestSupplyBody, AssignDistributorBody,
)
from services import (
    matching, waste, forecast, impact as impact_service, signals, simulation,
    transactions,
)

app = FastAPI(title="FOODFLOW API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    # Ensure the schema exists and the simulation clock has an anchor even
    # if the server is started before seed.py has ever been run.
    conn = get_connection()
    init_schema(conn)
    simulation.ensure_anchor(conn)
    conn.close()


def add_event(conn, message, type_="info"):
    conn.execute(
        "INSERT INTO events (timestamp, message, type) VALUES (?, ?, ?)",
        (simulation.get_sim_now(conn).isoformat(), message, type_),
    )


# ---------------------------------------------------------------- locations
@app.get("/api/locations")
def list_locations(conn=Depends(get_db)):
    rows = conn.execute("SELECT * FROM locations").fetchall()
    return [dict(r) for r in rows]


# --------------------------------------------------------------------- users
@app.get("/api/users")
def list_users(role: str | None = None, conn=Depends(get_db)):
    q = """SELECT u.*, l.name AS location_name, l.lat AS lat, l.lng AS lng, l.type as location_type
           FROM users u JOIN locations l ON u.location_id = l.id"""
    params = []
    if role:
        q += " WHERE u.role = ?"
        params.append(role)
    rows = conn.execute(q, params).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/users/{user_id}/profile")
def get_profile(user_id: int, conn=Depends(get_db)):
    """Lightweight public profile: who this participant is and what they
    currently bring to (or need from) the network. No auth, no KYC."""
    row = conn.execute(
        """SELECT u.*, l.name AS location_name, l.type AS location_type
           FROM users u JOIN locations l ON u.location_id = l.id WHERE u.id = ?""",
        (user_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    profile = dict(row)

    foods = conn.execute(
        """SELECT DISTINCT food_item FROM inventory
           WHERE owner_id = ? AND status = 'available' AND quantity > 0""",
        (user_id,),
    ).fetchall()
    profile["foods"] = [f["food_item"] for f in foods]

    needs = conn.execute(
        "SELECT DISTINCT food_item FROM demand WHERE requester_id = ? AND status = 'open'",
        (user_id,),
    ).fetchall()
    profile["current_needs"] = [n["food_item"] for n in needs]

    if profile["role"] == "distributor":
        active = conn.execute(
            "SELECT COUNT(*) AS n FROM allocations WHERE distributor_id = ? AND status != 'delivered'",
            (user_id,),
        ).fetchone()["n"]
        delivered = conn.execute(
            "SELECT COUNT(*) AS n FROM allocations WHERE distributor_id = ? AND status = 'delivered'",
            (user_id,),
        ).fetchone()["n"]
        profile["active_moves"] = active
        profile["completed_moves"] = delivered

    return profile


# ---------------------------------------------------------------- inventory
@app.get("/api/inventory")
def list_inventory(owner_id: int | None = None, conn=Depends(get_db)):
    return waste.get_inventory_with_risk(conn, owner_id=owner_id, include_offline=True)


@app.post("/api/inventory", status_code=201)
def create_inventory(body: InventoryCreate, conn=Depends(get_db)):
    owner = conn.execute("SELECT * FROM users WHERE id = ?", (body.owner_id,)).fetchone()
    if not owner:
        raise HTTPException(404, "Owner not found")
    location = conn.execute("SELECT * FROM locations WHERE id = ?", (body.location_id,)).fetchone()
    if not location:
        raise HTTPException(404, "Location not found")
    try:
        datetime.fromisoformat(body.available_date)
    except ValueError:
        raise HTTPException(400, "available_date must be an ISO datetime string")

    sim_now = simulation.get_sim_now(conn)
    expiry_at = (sim_now + timedelta(hours=body.shelf_life_hours)).isoformat()

    cur = conn.execute(
        """INSERT INTO inventory
           (owner_id, food_item, category, quantity, unit, location_id,
            available_date, shelf_life_hours, expiry_at, priority, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')""",
        (body.owner_id, body.food_item, body.category, body.quantity, body.unit,
         body.location_id, body.available_date, body.shelf_life_hours, expiry_at, body.priority),
    )
    add_event(conn, f"{owner['name']} listed {body.quantity:.0f}{body.unit} of {body.food_item}.", "supply")
    conn.commit()
    return dict(conn.execute("SELECT * FROM inventory WHERE id = ?", (cur.lastrowid,)).fetchone())


@app.put("/api/inventory/{item_id}")
def update_inventory(item_id: int, body: InventoryUpdate, conn=Depends(get_db)):
    row = conn.execute("SELECT * FROM inventory WHERE id = ?", (item_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Inventory item not found")
    updates = body.model_dump(exclude_unset=True)
    if "quantity" in updates and updates["quantity"] < 0:
        raise HTTPException(400, "Quantity cannot be negative")
    if not updates:
        return dict(row)
    fields = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(f"UPDATE inventory SET {fields} WHERE id = ?", (*updates.values(), item_id))
    conn.commit()
    return dict(conn.execute("SELECT * FROM inventory WHERE id = ?", (item_id,)).fetchone())


@app.delete("/api/inventory/{item_id}", status_code=204)
def delete_inventory(item_id: int, conn=Depends(get_db)):
    row = conn.execute("SELECT * FROM inventory WHERE id = ?", (item_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Inventory item not found")
    conn.execute("DELETE FROM inventory WHERE id = ?", (item_id,))
    conn.commit()
    return None


# ------------------------------------------------------------------- demand
@app.get("/api/demand")
def list_demand(requester_id: int | None = None, conn=Depends(get_db)):
    q = """SELECT d.*, u.name AS requester_name, l.name AS location_name, l.lat as lat, l.lng as lng
           FROM demand d JOIN users u ON d.requester_id = u.id JOIN locations l ON d.location_id = l.id"""
    params = []
    if requester_id is not None:
        q += " WHERE d.requester_id = ?"
        params.append(requester_id)
    rows = conn.execute(q, params).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/demand", status_code=201)
def create_demand(body: DemandCreate, conn=Depends(get_db)):
    requester = conn.execute("SELECT * FROM users WHERE id = ?", (body.requester_id,)).fetchone()
    if not requester:
        raise HTTPException(404, "Requester not found")
    try:
        datetime.fromisoformat(body.needed_by)
    except ValueError:
        raise HTTPException(400, "needed_by must be an ISO datetime string")

    cur = conn.execute(
        """INSERT INTO demand
           (requester_id, food_item, category, quantity, quantity_received,
            needed_by, location_id, priority, recurring, status)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 'open')""",
        (body.requester_id, body.food_item, body.category, body.quantity, body.needed_by,
         body.location_id, body.priority, 1 if body.recurring else 0),
    )
    add_event(conn, f"{requester['name']} posted demand for {body.quantity:.0f}kg {body.food_item}.", "demand")
    conn.commit()
    return dict(conn.execute("SELECT * FROM demand WHERE id = ?", (cur.lastrowid,)).fetchone())


@app.put("/api/demand/{demand_id}")
def update_demand(demand_id: int, body: DemandUpdate, conn=Depends(get_db)):
    row = conn.execute("SELECT * FROM demand WHERE id = ?", (demand_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Demand not found")
    updates = body.model_dump(exclude_unset=True)
    if "recurring" in updates:
        updates["recurring"] = 1 if updates["recurring"] else 0
    if not updates:
        return dict(row)
    fields = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(f"UPDATE demand SET {fields} WHERE id = ?", (*updates.values(), demand_id))
    conn.commit()
    return dict(conn.execute("SELECT * FROM demand WHERE id = ?", (demand_id,)).fetchone())


@app.delete("/api/demand/{demand_id}", status_code=204)
def delete_demand(demand_id: int, conn=Depends(get_db)):
    row = conn.execute("SELECT * FROM demand WHERE id = ?", (demand_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Demand not found")
    conn.execute("DELETE FROM demand WHERE id = ?", (demand_id,))
    conn.commit()
    return None


# ------------------------------------------------------------------ matches
@app.get("/api/matches")
def get_matches(demand_id: int | None = None, food_item: str | None = None,
                 top_n: int = 20, conn=Depends(get_db)):
    matches = matching.compute_matches(conn, demand_id=demand_id, food_item=food_item, top_n=top_n)
    for m in matches:
        m["explanation"] = matching.explain_match(m)
    return matches


def _create_transaction(conn, inv_id: int, dem_id: int, requested_qty: float | None,
                         initiated_by: str = "buyer"):
    """Reserve a quantity of one inventory item against one demand and
    open a transaction awaiting distribution. Shared by both the
    match-accept path and the direct 'request from a listing' path."""
    inv = matching.get_inventory_for_scoring(conn, inv_id)
    dem = matching.get_demand_for_scoring(conn, dem_id)
    if not inv or not dem:
        raise HTTPException(404, "Inventory or demand record not found")

    sim_now = simulation.get_sim_now(conn)
    if waste.hours_remaining(inv["expiry_at"], sim_now) <= 0:
        raise HTTPException(400, "This food has expired and can no longer be moved.")
    if inv["status"] != "available":
        raise HTTPException(400, "This food is no longer available.")
    if dem["requester_id"] == inv["owner_id"]:
        raise HTTPException(400, "Supplier and buyer must be different organisations.")
    if dem["status"] != "open":
        raise HTTPException(400, "This request is no longer open.")

    free_qty = inv["available_qty"]
    if free_qty <= 0:
        raise HTTPException(400, "All of this food is already reserved by other requests.")

    outstanding = round(dem["quantity"] - dem["quantity_received"], 2)
    already_reserved_for_demand = conn.execute(
        "SELECT COALESCE(SUM(quantity), 0) AS q FROM allocations WHERE demand_id = ? AND status != 'delivered'",
        (dem_id,),
    ).fetchone()["q"]
    still_needed = round(outstanding - already_reserved_for_demand, 2)
    if still_needed <= 0:
        raise HTTPException(400, "This request is already fully covered by pending deliveries.")

    quantity = round(requested_qty if requested_qty else min(free_qty, still_needed), 2)
    if quantity <= 0:
        raise HTTPException(400, "Quantity must be greater than zero.")
    if quantity > free_qty + 1e-6:
        raise HTTPException(400, f"Only {free_qty:.0f} kg is available to request.")
    if quantity > still_needed + 1e-6:
        raise HTTPException(400, f"Only {still_needed:.0f} kg is still needed for this request.")

    detail = matching.score_pair(conn, inv_id, dem_id)
    distance_km = detail["distance_km"]

    # distance avoided: compare against the average distance of the other
    # candidate suppliers who could have served this same demand.
    alt_rows = matching._fetch_inventory(conn, food_item=dem["food_item"])
    alt_distances = [
        matching.haversine_km(r["lat"], r["lng"], dem["lat"], dem["lng"])
        for r in alt_rows if r["id"] != inv_id
    ]
    distance_avoided = 0.0
    if alt_distances:
        avg_alt = sum(alt_distances) / len(alt_distances)
        distance_avoided = round(max(0.0, avg_alt - distance_km), 1)
    co2_avoided = matching.estimate_transport(distance_avoided, quantity)["estimated_co2"] \
        if distance_avoided > 0 else 0
    rescued = 1 if detail["waste_risk"] in ("CRITICAL", "HIGH") else 0

    cur = conn.execute(
        """INSERT INTO allocations
           (inventory_id, demand_id, quantity, distance_km, match_score, score_breakdown,
            rescued, distance_avoided_km, co2_avoided_kg, status, initiated_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'distributor_needed', ?, ?)""",
        (inv_id, dem_id, quantity, distance_km, detail["match_score"],
         json.dumps(detail["score_breakdown"]), rescued, distance_avoided, co2_avoided,
         initiated_by, sim_now.isoformat()),
    )
    tx_id = cur.lastrowid

    est = matching.estimate_transport(distance_km, quantity)
    conn.execute(
        """INSERT INTO transport
           (allocation_id, origin_location_id, destination_location_id, distance_km, estimated_trips, estimated_co2)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (tx_id, inv["location_id"], dem["location_id"], distance_km,
         est["estimated_trips"], est["estimated_co2"]),
    )

    add_event(
        conn,
        f"{dem['requester_name']} requested {quantity:.0f}kg {inv['food_item']} from "
        f"{inv['owner_name']} ({distance_km:.1f}km, {detail['match_score']}% match). Awaiting distribution.",
        "transaction",
    )
    if rescued:
        add_event(
            conn,
            f"Rescue priority: {inv['food_item']} has {detail['hours_left']:.0f}h shelf life remaining.",
            "rescue",
        )
    conn.commit()
    return transactions.get_transaction(conn, tx_id)


@app.post("/api/matches/{match_id}/accept", status_code=201)
def accept_match(match_id: str, body: AcceptMatchBody, conn=Depends(get_db)):
    """Opens a transaction from a ranked match. Reserves stock; it is not
    physically moved until the transaction reaches 'delivered'."""
    try:
        inv_id, dem_id = (int(x) for x in match_id.split(":"))
    except ValueError:
        raise HTTPException(400, "Invalid match id")
    return _create_transaction(conn, inv_id, dem_id, body.quantity,
                               initiated_by=body.initiated_by or "buyer")


@app.post("/api/matches/{match_id}/reject")
def reject_match(match_id: str, conn=Depends(get_db)):
    try:
        inv_id, dem_id = (int(x) for x in match_id.split(":"))
    except ValueError:
        raise HTTPException(400, "Invalid match id")
    inv = conn.execute("SELECT food_item FROM inventory WHERE id = ?", (inv_id,)).fetchone()
    dem = conn.execute(
        """SELECT d.*, u.name as requester_name FROM demand d JOIN users u ON d.requester_id = u.id
           WHERE d.id = ?""", (dem_id,)).fetchone()
    if not inv or not dem:
        raise HTTPException(404, "Inventory or demand record not found")
    conn.execute(
        "INSERT OR REPLACE INTO rejected_matches (inventory_id, demand_id, created_at) VALUES (?, ?, ?)",
        (inv_id, dem_id, simulation.get_sim_now(conn).isoformat()),
    )
    add_event(conn, f"Match rejected: {inv['food_item']} for {dem['requester_name']}.", "info")
    conn.commit()
    return {"status": "rejected"}


# ------------------------------------------------------------ transactions
@app.get("/api/transactions")
def list_transactions(status: str | None = None, producer_id: int | None = None,
                      buyer_id: int | None = None, distributor_id: int | None = None,
                      unassigned_only: bool = False, conn=Depends(get_db)):
    return transactions.list_transactions(
        conn, status=status, producer_id=producer_id, buyer_id=buyer_id,
        distributor_id=distributor_id, unassigned_only=unassigned_only,
    )


@app.get("/api/transactions/{tx_id}")
def get_transaction(tx_id: int, conn=Depends(get_db)):
    tx = transactions.get_transaction(conn, tx_id)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    tx["explanation"] = matching.explain_match({
        "score_breakdown": tx["score_breakdown"],
        "prefer_local": False,
        "delayed_route": False,
    })
    return tx


@app.post("/api/transactions", status_code=201)
def request_supply(body: RequestSupplyBody, conn=Depends(get_db)):
    """A buyer requesting a specific quantity directly from a listing."""
    return _create_transaction(conn, body.inventory_id, body.demand_id, body.quantity,
                               initiated_by=body.initiated_by or "buyer")


@app.post("/api/transactions/{tx_id}/assign")
def assign_distributor(tx_id: int, body: AssignDistributorBody, conn=Depends(get_db)):
    distributor = conn.execute(
        "SELECT * FROM users WHERE id = ? AND role = 'distributor'", (body.distributor_id,)
    ).fetchone()
    if not distributor:
        raise HTTPException(404, "Distributor not found")
    tx = transactions.get_transaction(conn, tx_id)
    if not tx:
        raise HTTPException(404, "Transaction not found")

    # Respect the distributor's declared capacity / service area.
    if distributor["capacity_kg"] and tx["quantity"] > distributor["capacity_kg"] + 1e-6:
        raise HTTPException(
            400,
            f"This move is {tx['quantity']:.0f} kg, above your {distributor['capacity_kg']:.0f} kg capacity.",
        )
    if distributor["service_area_km"] and tx["distance_km"] > distributor["service_area_km"] + 1e-6:
        raise HTTPException(
            400,
            f"This move is {tx['distance_km']:.1f} km, outside your {distributor['service_area_km']:.0f} km service area.",
        )

    try:
        updated = transactions.assign_distributor(
            conn, tx_id, body.distributor_id, simulation.get_sim_now(conn)
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    add_event(
        conn,
        f"{distributor['name']} accepted the delivery of {updated['quantity']:.0f}kg "
        f"{updated['food_item']} from {updated['producer_name']} to {updated['buyer_name']}.",
        "transaction",
    )
    conn.commit()
    return updated


@app.post("/api/transactions/{tx_id}/decline")
def decline_transaction(tx_id: int, conn=Depends(get_db)):
    try:
        updated = transactions.decline_assignment(conn, tx_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    add_event(conn, f"Delivery of {updated['quantity']:.0f}kg {updated['food_item']} "
                    f"released back to available moves.", "transaction")
    conn.commit()
    return updated


@app.post("/api/transactions/{tx_id}/pickup")
def pickup_transaction(tx_id: int, conn=Depends(get_db)):
    try:
        updated = transactions.mark_picked_up(conn, tx_id, simulation.get_sim_now(conn))
    except ValueError as e:
        raise HTTPException(400, str(e))
    add_event(conn, f"{updated['quantity']:.0f}kg {updated['food_item']} picked up from "
                    f"{updated['producer_name']}.", "transaction")
    conn.commit()
    return updated


@app.post("/api/transactions/{tx_id}/deliver")
def deliver_transaction(tx_id: int, conn=Depends(get_db)):
    """The only step that physically moves stock and fulfils demand."""
    try:
        updated = transactions.mark_delivered(conn, tx_id, simulation.get_sim_now(conn))
    except ValueError as e:
        raise HTTPException(400, str(e))
    add_event(conn, f"Delivered {updated['quantity']:.0f}kg {updated['food_item']} to "
                    f"{updated['buyer_name']}. Demand reduced.", "allocation")
    if updated["rescued"]:
        add_event(conn, f"Estimated {updated['quantity']:.0f}kg of {updated['food_item']} "
                        f"saved from waste.", "rescue")
    conn.commit()
    return updated


# --------------------------------------------------------------- waste risk
@app.get("/api/waste-risk")
def get_waste_risk(conn=Depends(get_db)):
    return {
        "items": waste.get_inventory_with_risk(conn),
        "watch": waste.get_waste_watch(conn),
    }


# ---------------------------------------------------------------- forecast
@app.get("/api/forecast/{entity}")
def get_forecast(entity: int, food_item: str | None = None, conn=Depends(get_db)):
    if food_item:
        return forecast.forecast_for(conn, entity, food_item)
    return forecast.forecast_for_requester(conn, entity)


# ------------------------------------------------------------------ impact
@app.get("/api/impact")
def get_impact(conn=Depends(get_db)):
    return impact_service.get_impact(conn)


# ----------------------------------------------------------------- signals
@app.get("/api/signals")
def get_signals(conn=Depends(get_db)):
    return signals.get_signals(conn)


# ------------------------------------------------------------------ events
@app.get("/api/events")
def get_events(limit: int = 30, conn=Depends(get_db)):
    rows = conn.execute("SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


# ------------------------------------------------------------------- state
@app.get("/api/state")
def get_state(conn=Depends(get_db)):
    return simulation.get_clock_state(conn)


@app.post("/api/simulation/clock")
def move_clock(body: ClockBody, conn=Depends(get_db)):
    state = simulation.shift_clock(conn, hours=body.hours, reset=body.reset)
    add_event(conn, f"Simulation clock moved. Current time: {state['sim_now']}.", "info")
    conn.commit()
    return state


@app.post("/api/simulation/{scenario}")
def run_scenario(scenario: str, conn=Depends(get_db)):
    valid = {"normal", "supply_shock", "transport_delay", "demand_surge", "food_spoilage"}
    if scenario not in valid:
        raise HTTPException(400, f"Unknown scenario. Use one of: {', '.join(sorted(valid))}")
    result = simulation.apply_scenario(conn, scenario)
    return result


# -------------------------------------------------------------------- misc
@app.post("/api/reset")
def full_reset():
    import seed
    seed.run()
    return {"status": "reset"}


@app.get("/api/health")
def health():
    return {"status": "ok"}
