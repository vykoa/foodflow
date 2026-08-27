# FOODFLOW

**Move food before it becomes waste.**

FOODFLOW is a local food exchange and distribution intelligence platform. It makes local
food *supply* and local food *demand* visible in the same system, then uses a deterministic,
explainable matching engine to recommend where available food should go — before it spoils.

Built for the Millbrook local food network: 5 producers, 2 distributors, 2 schools, a
community kitchen, 2 markets, several households and a small business, all sharing one
database, one matching engine, and one set of live metrics.

---

## Quick start

**Requirements:** Python 3.10+ and Node 18+ (this repo was built and tested with Python 3.12
and Node 26). A virtualenv for the backend is already set up at `backend/venv`.

### 1. Backend (FastAPI + SQLite), from `foodflow/backend/`

```bash
python3 -m venv venv                 # first time only
./venv/bin/pip install -r requirements.txt   # first time only
./venv/bin/python seed.py            # (re)seed the database with the Millbrook demo data
./venv/bin/uvicorn main:app --port 8000 --reload
```

Backend runs at `http://localhost:8000`. Try `http://localhost:8000/docs` for interactive
API docs (FastAPI's built-in Swagger UI).

### 2. Frontend (React + Vite), from `foodflow/frontend/`

```bash
npm install       # first time only
npm run dev
```

Frontend runs at `http://localhost:5173`. Open it, pick a role (or hit **Start Demo**), and
you're in.

### Resetting the demo

Click **Reset Demo** in the top bar at any time, or `POST /api/reset`, or re-run
`seed.py` — all three restore the exact same seeded starting state.

---

## What's actually implemented

- **One shared data model.** Every screen (Overview, Local Food, Supply, Demand, Inventory,
  Smart Matches, Waste Watch, Map, Impact) reads from the same SQLite database through the
  same FastAPI endpoints. There is no per-page mock data.
- **A deterministic matching engine** (see below) that scores every viable supply/demand
  pair 0-100% from six weighted, inspectable factors, with a "Why this match?" breakdown.
- **A real allocation flow.** Accepting a match writes an `allocations` row, reduces the
  supplier's inventory, reduces the buyer's outstanding demand, logs transport estimates,
  and pushes events into the activity feed — all in one transaction.
- **A simulated clock**, not a fake countdown. `-6H / NOW / +6H / +12H` change a stored
  clock offset; every shelf-life, risk, and match calculation reads that offset live, so
  moving time forward actually changes what the app shows.
- **Five "What If?" resilience scenarios** (Normal, Supply Shock, Transport Delay, Demand
  Surge, Food Spoilage) that mutate real rows (with a backup so "Normal" can revert them)
  and force the matching engine to recalculate around the disruption.
- **A guided, non-scripted Demo Mode** that drives the real app (real API calls, real
  acceptances, a real scenario trigger) rather than a slideshow.

## Architecture

```
foodflow/
  backend/
    main.py                 FastAPI app: all REST endpoints, one SQLite connection per request
    database.py              schema + connection helper + full reset
    schemas.py                Pydantic request/response models
    seed.py                    seeds the Millbrook demo network (run directly or via /api/reset)
    services/
      matching.py            THE MATCHING ENGINE — scoring, ranking, explanations
      waste.py                waste-risk levels from shelf life vs. the simulation clock
      forecast.py             weighted moving-average demand forecasting
      impact.py                 sustainability metrics, derived only from accepted allocations
      signals.py                 surplus/shortage aggregation ("FOODFLOW SIGNALS")
      simulation.py            simulation clock + What If? scenario engine
  frontend/
    src/
      pages/                  one page per nav section (Overview, LocalFood, Supply, ...)
      components/            Sidebar, TopBar, MatchCard, FoodCard, RiskBadge, DemoGuide, ...
      context/AppContext.jsx  current user/role, simulation state, a refresh signal
      services/api.js         the only place that talks to the backend
```

**Why this shape:** no ORM, no auth system, no message queue, no state-management library —
raw `sqlite3` with named-column rows, plain `fetch` calls, and React context. Small enough
that a beginner can open `main.py` and `matching.py` and understand the whole system in one
sitting, per the brief's "simplicity of architecture" priority.

### The matching engine

`backend/services/matching.py` — scores every open demand against every available inventory
item of the same food type:

| Factor | Weight |
|---|---|
| Demand urgency | 25% |
| Shelf-life risk | 25% |
| Proximity | 20% |
| Quantity fit | 15% |
| Destination priority | 10% |
| Transport efficiency | 5% |

Each factor is a plain, commented function (`score_urgency`, `score_shelf_life`, etc.) —
no ML, nothing hidden. The weights live in one `WEIGHTS` dict at the top of the file, so
they're trivial to retune. `explain_match()` turns the same numbers used for scoring into
the bullet list shown behind **"Why this match?"** in the UI.

### The waste engine

`backend/services/waste.py` — converts `shelf_life_hours` / `expiry_at` into a risk level
(`CRITICAL` ≤24h, `HIGH` ≤72h, `MEDIUM` ≤168h, else `LOW`) relative to the *simulated* clock,
and ranks rescue destinations for at-risk stock via the matching engine. Backs both the
Waste Watch page and the Food Rescue Clock visual.

### The forecasting logic

`backend/services/forecast.py` — a weighted moving average over each requester's
`historical_demand` records (most recent days weighted highest). Deliberately isolated from
the rest of the app so it can be swapped for a stronger model later without touching any
caller.

### Simulation & resilience

`backend/services/simulation.py` — owns the simulated clock (`anchor_time + offset_hours`,
both in the `settings` table) and the five What If? scenarios. Scenario application mutates
real inventory/demand rows and snapshots what it changed, so selecting "Normal" reverts to
baseline.

---

## API surface

`GET/POST /api/inventory`, `GET/POST /api/demand` (+ `PUT`/`DELETE` on both), `GET
/api/matches`, `POST /api/matches/{id}/accept|reject`, `GET /api/waste-risk`, `GET
/api/forecast/{entity}`, `GET /api/impact`, `GET /api/signals`, `GET /api/events`, `GET
/api/locations`, `GET /api/users`, `GET /api/state`, `POST /api/simulation/clock`, `POST
/api/simulation/{scenario}`, `POST /api/reset`.

## Demo script (also built into "Start Demo")

1. **Local Food** — browse what's available across the network right now.
2. **Demand** — see open shortages across schools, kitchens, markets, households.
3. **Overview → FOODFLOW Signals** — surplus (potatoes, rice, lentils) sitting next to
   real shortages (tomatoes) nobody has covered.
4. **Waste Watch** — Sunrise Orchards' 150kg of bananas, 18 hours from spoiling.
5. **Smart Matches** — ranked, explainable supply → demand recommendations.
6. **Accept** the top match — inventory, demand, activity feed and Impact all update live.
7. **What If? → Supply Shock** — Metro Foods Supply goes offline; matches recalculate
   instantly around it.
8. **-6H / +12H** — advance the simulation clock and watch waste risk change in real time.

Every step above uses the real database through the real API — nothing on screen is a
static mock.
