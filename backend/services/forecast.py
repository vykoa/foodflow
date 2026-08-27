"""
Demand forecasting - deliberately simple and transparent (weighted
moving average over recent historical_demand records), so it can be
swapped for a stronger model later without touching any caller.
"""

# Most-recent record gets the highest weight.
WEIGHTS = [5, 4, 3, 2, 1]


def forecast_for(conn, requester_id: int, food_item: str) -> dict:
    rows = conn.execute(
        """
        SELECT date, quantity FROM historical_demand
        WHERE requester_id = ? AND LOWER(food_item) = LOWER(?)
        ORDER BY date DESC LIMIT 5
        """,
        (requester_id, food_item),
    ).fetchall()

    history = [{"date": r["date"], "quantity": r["quantity"]} for r in reversed(rows)]

    if len(rows) == 0:
        return {
            "food_item": food_item,
            "history": [],
            "forecast": None,
            "explanation": "No historical demand recorded yet for this item.",
        }

    weights = WEIGHTS[: len(rows)]
    weighted_sum = sum(r["quantity"] * w for r, w in zip(rows, weights))
    forecast = round(weighted_sum / sum(weights), 1)

    return {
        "food_item": food_item,
        "history": history,
        "forecast": forecast,
        "explanation": (
            f"Based on the last {len(rows)} recorded day(s) of demand, weighted toward "
            "the most recent days."
        ),
    }


def forecast_for_requester(conn, requester_id: int) -> list[dict]:
    """All distinct food items this requester has demand history for."""
    items = conn.execute(
        "SELECT DISTINCT food_item FROM historical_demand WHERE requester_id = ?",
        (requester_id,),
    ).fetchall()
    return [forecast_for(conn, requester_id, r["food_item"]) for r in items]
