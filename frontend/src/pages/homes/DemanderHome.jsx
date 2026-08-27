import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import { useApp } from "../../context/AppContext";
import PriorityPill from "../../components/PriorityPill";

export default function DemanderHome() {
  const { currentUser, refreshKey } = useApp();
  const [demand, setDemand] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    Promise.all([api.getDemand(currentUser.id), api.getMatches({ top_n: 40 })])
      .then(([dem, allMatches]) => {
        setDemand(dem);
        const mine = new Set(dem.map((d) => d.id));
        setMatches(allMatches.filter((m) => mine.has(m.demand_id)));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentUser, refreshKey]);

  if (loading) return <p className="text-sm text-muted">Loading your food network…</p>;

  const openNeeds = demand.filter((d) => d.status === "open");
  const onHandQty = Math.round(demand.reduce((s, d) => s + d.quantity_received, 0));
  const nearbySupplyCount = matches.length;

  // Group best match per food item, pick the single strongest recommendation.
  const byFood = {};
  for (const m of matches) {
    if (!byFood[m.food_item]) byFood[m.food_item] = [];
    byFood[m.food_item].push(m);
  }
  const topFood = Object.entries(byFood).sort((a, b) => b[1][0].match_score - a[1][0].match_score)[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-tight">Your needs. Supplied nearby.</h1>
        <p className="mt-1 text-sm text-ink/60">{currentUser.name} · {currentUser.role}</p>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line">
        <div className="bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Open needs</div>
          <div className="mt-1 text-2xl font-bold">{openNeeds.length}</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">On hand</div>
          <div className="mt-1 text-2xl font-bold">{onHandQty} kg</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Nearby supply</div>
          <div className="mt-1 text-2xl font-bold text-brand-600">{nearbySupplyCount} match{nearbySupplyCount === 1 ? "" : "es"}</div>
        </div>
      </div>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">FoodFlow Recommends</h2>
        {!topFood ? (
          <p className="panel mt-2 p-4 text-sm text-muted">
            No local matches yet — post a need, and FoodFlow will look for nearby sources.
          </p>
        ) : (
          <div className="panel mt-2 border-l-4 border-l-brand-500 p-4">
            <p className="text-[15px] leading-snug text-ink">
              <strong>{topFood[0]}</strong> · {topFood[1].length} nearby source{topFood[1].length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-sm text-ink/70">
              Best match: <strong>{topFood[1][0].supplier_name}</strong> · {topFood[1][0].distance_km} km ·{" "}
              <span className="font-semibold text-brand-600">{topFood[1][0].match_score}% match</span>
            </p>
            <Link to="/app/find-food" className="btn-primary mt-3 inline-block">Request supply</Link>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">My Needs</h2>
          <Link to="/app/my-needs" className="text-xs font-semibold text-brand-600 hover:underline">Manage needs →</Link>
        </div>
        <div className="panel mt-2 overflow-hidden">
          <table className="data-table">
            <thead><tr><th>Food</th><th>Need</th><th>Received</th><th>Priority</th></tr></thead>
            <tbody>
              {demand.length === 0 && <tr><td colSpan={4} className="text-muted">No needs posted yet.</td></tr>}
              {demand.slice(0, 5).map((d) => (
                <tr key={d.id}>
                  <td className="font-medium">{d.food_item}</td>
                  <td>{d.quantity} kg</td>
                  <td>{d.quantity_received} kg</td>
                  <td><PriorityPill priority={d.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">My Inventory</h2>
          <Link to="/app/my-inventory" className="text-xs font-semibold text-brand-600 hover:underline">Details & forecast →</Link>
        </div>
        <p className="panel mt-2 p-4 text-sm text-ink/70">
          {onHandQty} kg received so far against {Math.round(demand.reduce((s, d) => s + d.quantity, 0))} kg requested.
        </p>
      </section>
    </div>
  );
}
