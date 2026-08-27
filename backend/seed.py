"""
Seed data for FOODFLOW.

Builds one compact fictional local-food network ("Millbrook" area) with
enough intentional imbalance - surplus here, shortage there, one item
close to expiry, several plausible destinations - that the matching
engine has real, interesting decisions to make on first load.

Run directly:  python seed.py
"""
from datetime import datetime, timedelta

from database import db_session, init_schema, reset_database
from services.simulation import ensure_anchor

# Anchor = the simulated "now" for the whole demo. All shelf lives /
# needed-by dates are expressed relative to this so the story always
# starts in the same state no matter when you actually run the seed.
ANCHOR = datetime.utcnow().replace(minute=0, second=0, microsecond=0)


def h(hours):
    """Anchor + hours, as an ISO string."""
    return (ANCHOR + timedelta(hours=hours)).isoformat()


LOCATIONS = [
    # name, type, lat, lng, address
    ("Green Valley Farm", "producer", 12.9720, 77.5950, "Millbrook Rural Rd 1"),
    ("Sunrise Orchards", "producer", 12.9850, 77.6100, "Millbrook Rural Rd 2"),
    ("Riverside Growers", "producer", 12.9600, 77.6200, "Riverside Lane 4"),
    ("Golden Fields Farm", "producer", 13.0050, 77.5800, "North County Rd 7"),
    ("Blue Hill Produce", "producer", 12.9400, 77.5700, "Blue Hill Rd 3"),
    ("Metro Foods Supply", "distributor", 12.9750, 77.6050, "Industrial Ave 12"),
    ("Harborline Distribution", "distributor", 12.9900, 77.5650, "Harborline Dock 2"),
    ("Lakeside Elementary", "school", 12.9680, 77.6000, "Lakeside St 8"),
    ("Northgate High", "school", 13.0000, 77.6150, "Northgate Blvd 21"),
    ("Hope Community Kitchen", "kitchen", 12.9770, 77.5880, "Community Sq 5"),
    ("Central Market", "market", 12.9730, 77.6080, "Market St 1"),
    ("Riverside Market", "market", 12.9620, 77.6180, "Riverside Lane 9"),
    ("Household - Mill Street", "household", 12.9705, 77.5995, "Mill St 14"),
    ("Household - Oak Avenue", "household", 12.9805, 77.6020, "Oak Ave 22"),
    ("Household - Cedar Lane", "household", 12.9550, 77.5900, "Cedar Ln 6"),
    ("Millbrook Cafe", "business", 12.9740, 77.5970, "High St 3"),
    ("Cedarline Transport", "distributor", 12.9660, 77.5920, "Depot Rd 4"),
]

# name, role, location index (into LOCATIONS), then the optional
# distribution-capacity profile (vehicle, capacity kg, service area km).
# Only distributors carry a capacity profile; everyone else has None.
USERS = [
    ("Green Valley Farm", "farmer", 0, None, None, None),
    ("Sunrise Orchards", "farmer", 1, None, None, None),
    ("Riverside Growers", "producer", 2, None, None, None),
    ("Golden Fields Farm", "farmer", 3, None, None, None),
    ("Blue Hill Produce", "producer", 4, None, None, None),
    ("Metro Foods Supply", "supplier", 5, None, None, None),
    ("Harborline Distribution", "distributor", 6, "Light goods vehicle", 500, 10),
    ("Lakeside Elementary", "school", 7, None, None, None),
    ("Northgate High", "school", 8, None, None, None),
    ("Hope Community Kitchen", "kitchen", 9, None, None, None),
    ("Central Market", "market", 10, None, None, None),
    ("Riverside Market", "market", 11, None, None, None),
    ("Household - Mill Street", "household", 12, None, None, None),
    ("Household - Oak Avenue", "household", 13, None, None, None),
    ("Household - Cedar Lane", "household", 14, None, None, None),
    ("Millbrook Cafe", "business", 15, None, None, None),
    # A smaller second distributor, so capacity limits are visible in the
    # demo: it cannot take the largest moves, which makes the constraint real.
    ("Cedarline Transport", "distributor", 16, "Small van", 150, 6),
]

# owner index (into USERS), food_item, category, quantity, unit, shelf_life_hours, priority
INVENTORY = [
    (0, "Tomatoes", "vegetable", 500, "kg", 48, "HIGH"),
    (0, "Onions", "vegetable", 200, "kg", 720, "LOW"),
    (1, "Bananas", "fruit", 150, "kg", 18, "CRITICAL"),
    (1, "Bananas", "fruit", 80, "kg", 96, "MEDIUM"),
    (2, "Vegetables", "vegetable", 300, "kg", 96, "MEDIUM"),
    (2, "Lentils", "grain", 400, "kg", 2160, "LOW"),
    (3, "Potatoes", "vegetable", 900, "kg", 1440, "LOW"),
    (3, "Milk", "dairy", 150, "kg", 72, "HIGH"),
    (4, "Seasonal Produce", "fruit", 200, "kg", 60, "HIGH"),
    (4, "Eggs", "dairy", 100, "kg", 120, "MEDIUM"),
    (5, "Rice", "grain", 900, "kg", 2160, "LOW"),
    (5, "Tomatoes", "vegetable", 250, "kg", 60, "HIGH"),
    (5, "Lentils", "grain", 250, "kg", 3000, "LOW"),
    (6, "Onions", "vegetable", 300, "kg", 960, "LOW"),
    (6, "Vegetables", "vegetable", 180, "kg", 50, "HIGH"),
    (6, "Milk", "dairy", 80, "kg", 40, "HIGH"),
    (10, "Bananas", "fruit", 60, "kg", 30, "HIGH"),
    (10, "Potatoes", "vegetable", 200, "kg", 720, "LOW"),
    (11, "Tomatoes", "vegetable", 90, "kg", 40, "HIGH"),
    (11, "Rice", "grain", 150, "kg", 1000, "LOW"),
]

# requester index (into USERS), food_item, category, quantity, needed_in_hours, priority, recurring
DEMAND = [
    (7, "Tomatoes", "vegetable", 150, 22, "HIGH", False),
    (7, "Vegetables", "vegetable", 90, 48, "NORMAL", False),
    (8, "Rice", "grain", 300, 120, "HIGH", True),
    (8, "Vegetables", "vegetable", 100, 44, "NORMAL", False),
    (9, "Bananas", "fruit", 60, 4, "CRITICAL", False),
    (9, "Vegetables", "vegetable", 80, 20, "HIGH", False),
    (9, "Milk", "dairy", 50, 40, "NORMAL", False),
    (10, "Vegetables", "vegetable", 180, 48, "NORMAL", False),
    (10, "Onions", "vegetable", 100, 96, "LOW", False),
    (11, "Tomatoes", "vegetable", 100, 24, "HIGH", False),
    (11, "Bananas", "fruit", 40, 48, "NORMAL", False),
    (12, "Rice", "grain", 20, 72, "LOW", False),
    (13, "Vegetables", "vegetable", 15, 48, "NORMAL", False),
    (15, "Tomatoes", "vegetable", 40, 40, "NORMAL", False),
]

# historical demand series (requester index, food_item, [qty per day, oldest..newest])
HISTORY = [
    (8, "Rice", [70, 68, 72, 71, 74]),
    (7, "Tomatoes", [140, 145, 138, 152, 148]),
    (9, "Vegetables", [75, 78, 70, 82, 80]),
    (10, "Vegetables", [160, 158, 170, 165, 175]),
]


def run():
    reset_database()
    with db_session() as conn:
        init_schema(conn)
        ensure_anchor(conn, ANCHOR)

        location_ids = []
        for name, type_, lat, lng, address in LOCATIONS:
            cur = conn.execute(
                "INSERT INTO locations (name, type, lat, lng, address) VALUES (?, ?, ?, ?, ?)",
                (name, type_, lat, lng, address),
            )
            location_ids.append(cur.lastrowid)

        user_ids = []
        for name, role, loc_idx, vehicle, capacity, service_area in USERS:
            cur = conn.execute(
                """INSERT INTO users (name, role, location_id, vehicle_type, capacity_kg, service_area_km)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (name, role, location_ids[loc_idx], vehicle, capacity, service_area),
            )
            user_ids.append(cur.lastrowid)

        for owner_idx, food, category, qty, unit, shelf_hours, priority in INVENTORY:
            conn.execute(
                """INSERT INTO inventory
                   (owner_id, food_item, category, quantity, unit, location_id,
                    available_date, shelf_life_hours, expiry_at, priority, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')""",
                (
                    user_ids[owner_idx],
                    food,
                    category,
                    qty,
                    unit,
                    location_ids[USERS[owner_idx][2]],
                    h(0),
                    shelf_hours,
                    h(shelf_hours),
                    priority,
                ),
            )

        for requester_idx, food, category, qty, needed_hours, priority, recurring in DEMAND:
            conn.execute(
                """INSERT INTO demand
                   (requester_id, food_item, category, quantity, quantity_received,
                    needed_by, location_id, priority, recurring, status)
                   VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 'open')""",
                (
                    user_ids[requester_idx],
                    food,
                    category,
                    qty,
                    h(needed_hours),
                    location_ids[USERS[requester_idx][2]],
                    priority,
                    1 if recurring else 0,
                ),
            )

        for requester_idx, food, series in HISTORY:
            for day_offset, qty in enumerate(series):
                date = (ANCHOR - timedelta(days=len(series) - day_offset)).date().isoformat()
                conn.execute(
                    "INSERT INTO historical_demand (requester_id, food_item, date, quantity) VALUES (?, ?, ?, ?)",
                    (user_ids[requester_idx], food, date, qty),
                )

        conn.execute(
            "INSERT INTO events (timestamp, message, type) VALUES (?, ?, ?)",
            (ANCHOR.isoformat(), "FOODFLOW network initialized for Millbrook.", "info"),
        )
        conn.commit()

    print(f"Seeded FOODFLOW database. Anchor time: {ANCHOR.isoformat()}")
    print(f"Locations: {len(LOCATIONS)}, Users: {len(USERS)}, Inventory: {len(INVENTORY)}, "
          f"Demand: {len(DEMAND)}, Historical records: {sum(len(s) for _, _, s in HISTORY)}")


if __name__ == "__main__":
    run()
