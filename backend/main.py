"""
FOODFLOW backend - FastAPI app.

One source of truth: every endpoint reads/writes the same SQLite
database. Nothing here is a per-view hardcoded fixture - accepting an
allocation updates inventory, demand, allocations, transport and the
event feed in a single transaction, so every screen that reads from
the DB reflects it immediately.
"""
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware

from database import get_db, init_schema, get_connection
from schemas import (
    InventoryCreate, InventoryUpdate, DemandCreate, DemandUpdate,
    AcceptMatchBody, ClockBody,
)
from services import matching, waste, forecast, impact as impact_service, signals, simulation

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


@app.post("/api/matches/{match_id}/accept")
def accept_match(match_id: str, body: AcceptMatchBody, conn=Depends(get_db)):
    try:
        inv_id, dem_id = (int(x) for x in match_id.split(":"))
    except ValueError:
        raise HTTPException(400, "Invalid match id")

    inv = conn.execute(
        """SELECT i.*, u.name AS owner_name, l.name AS location_name, l.lat AS lat, l.lng AS lng
           FROM inventory i JOIN users u ON i.owner_id = u.id JOIN locations l ON i.location_id = l.id
           WHERE i.id = ?""", (inv_id,)).fetchone()
    dem = conn.execute(
        """SELECT d.*, u.name AS requester_name, l.name AS location_name, l.lat AS lat, l.lng AS lng
           FROM demand d JOIN users u ON d.requester_id = u.id JOIN locations l ON d.location_id = l.id
           WHERE d.id = ?""", (dem_id,)).fetchone()
    if not inv or not dem:
        raise HTTPException(404, "Inventory or demand record not found")

    sim_now = simulation.get_sim_now(conn)
    hours_left = waste.hours_remaining(inv["expiry_at"], sim_now)
    if hours_left <= 0:
        raise HTTPException(400, "This food item has expired and cannot be allocated.")
    if inv["status"] != "available" or inv["quantity"] <= 0:
        raise HTTPException(400, "This inventory is no longer available.")
    if dem["status"] != "open":
        raise HTTPException(400, "This demand is no longer open.")

    remaining_demand = round(dem["quantity"] - dem["quantity_received"], 2)
    if remaining_demand <= 0:
        raise HTTPException(400, "This demand has already been fulfilled.")

    quantity = body.quantity if body.quantity else min(inv["quantity"], remaining_demand)
    if quantity <= 0:
        raise HTTPException(400, "Quantity must be greater than zero.")
    if quantity > inv["quantity"] + 1e-6:
        raise HTTPException(400, f"Cannot allocate more than the {inv['quantity']:.0f}kg available.")
    if quantity > remaining_demand + 1e-6:
        raise HTTPException(400, f"Cannot allocate more than the {remaining_demand:.0f}kg still needed.")

    delayed_location = simulation.get_delayed_location_id(conn)
    detail = matching._score_pair(conn, inv, dem, sim_now, delayed_location)
    distance_km = detail["distance_km"]

    # distance avoided: compare against the average distance of other
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
    transport = matching.estimate_transport(distance_avoided, quantity) if distance_avoided > 0 else \
        {"estimated_trips": 0, "estimated_co2": 0}
    co2_avoided = transport["estimated_co2"]

    rescued = 1 if detail["waste_risk"] in ("CRITICAL", "HIGH") else 0

    import json
    cur = conn.execute(
        """INSERT INTO allocations
           (inventory_id, demand_id, quantity, distance_km, match_score, score_breakdown,
            rescued, distance_avoided_km, co2_avoided_kg, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted', ?)""",
        (inv_id, dem_id, quantity, distance_km, detail["match_score"], json.dumps(detail["score_breakdown"]),
         rescued, distance_avoided, co2_avoided, sim_now.isoformat()),
    )
    allocation_id = cur.lastrowid

    real_transport = matching.estimate_transport(distance_km, quantity)
    conn.execute(
        """INSERT INTO transport
           (allocation_id, origin_location_id, destination_location_id, distance_km, estimated_trips, estimated_co2)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (allocation_id, inv["location_id"], dem["location_id"], distance_km,
         real_transport["estimated_trips"], real_transport["estimated_co2"]),
    )

    new_inv_qty = round(inv["quantity"] - quantity, 2)
    new_inv_status = "depleted" if new_inv_qty <= 0.01 else "available"
    conn.execute("UPDATE inventory SET quantity = ?, status = ? WHERE id = ?",
                 (max(new_inv_qty, 0), new_inv_status, inv_id))

    new_received = round(dem["quantity_received"] + quantity, 2)
    new_dem_status = "fulfilled" if new_received >= dem["quantity"] - 0.01 else "open"
    conn.execute("UPDATE demand SET quantity_received = ?, status = ? WHERE id = ?",
                 (new_received, new_dem_status, dem_id))

    add_event(
        conn,
        f"{inv['owner_name']} allocated {quantity:.0f}kg {inv['food_item']} to "
        f"{dem['requester_name']} ({distance_km:.1f}km, {detail['match_score']}% match).",
        "allocation",
    )
    if rescued:
        add_event(conn, f"Estimated {quantity:.0f}kg of {inv['food_item']} waste risk removed.", "rescue")

    conn.commit()
    return {
        "allocation_id": allocation_id,
        "quantity": quantity,
        "distance_km": distance_km,
        "match_score": detail["match_score"],
        "rescued": bool(rescued),
        "distance_avoided_km": distance_avoided,
        "co2_avoided_kg": co2_avoided,
    }


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
