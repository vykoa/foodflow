import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, isSupplyRole } from "../context/AppContext";
import { api } from "../services/api";
import StatTile from "../components/StatTile";
import ActivityFeed from "../components/ActivityFeed";
import RiskBadge from "../components/RiskBadge";
import PriorityPill from "../components/PriorityPill";

export default function Overview() {
  const { currentUser, refreshKey } = useApp();
  const [impact, setImpact] = useState(null);
  const [signals, setSignals] = useState(null);
  const [myInventory, setMyInventory] = useState([]);
  const [myDemand, setMyDemand] = useState([]);
  const [watch, setWatch] = useState([]);
  const [matches, setMatches] = useState([]);

  const supplySide = currentUser ? isSupplyRole(currentUser.role) : true;

  useEffect(() => {
    api.getImpact().then(setImpact).catch(console.error);
    api.getSignals().then(setSignals).catch(console.error);
    api.getWasteRisk().then((d) => setWatch(d.watch)).catch(console.error);
    if (currentUser) {
      if (isSupplyRole(currentUser.role)) {
        api.getInventory(currentUser.id).then(setMyInventory).catch(console.error);
      } else {
        api.getDemand(currentUser.id).then(setMyDemand).catch(console.error);
        api.getMatches({ top_n: 30 }).then(setMatches).catch(console.error);
      }
    }
  }, [currentUser, refreshKey]);

  const myAtRisk = myInventory.filter((i) => ["CRITICAL", "HIGH"].includes(i.waste_risk));
  const topWatch = watch[0];
  const myOpenDemand = myDemand.filter((d) => d.status === "open");
  const relevantMatches = matches.filter((m) => myOpenDemand.some((d) => d.id === m.demand_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Overview</h1>
        <p className="text-sm text-muted">
          {currentUser ? `Welcome back, ${currentUser.name}.` : "The Millbrook local food network."}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Local Food Network — Today</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label="Available Today" value={impact ? `${impact.food_available_today} kg` : "…"} />
          <StatTile label="Allocated" value={impact ? `${impact.food_allocated} kg` : "…"} tone="brand" />
          <StatTile label="At Risk of Waste" value={impact ? `${impact.at_risk_of_waste} kg` : "…"} tone="crit" />
          <StatTile label="Unmet Demand" value={impact ? `${impact.unmet_demand} kg` : "…"} tone="amber" />
          <StatTile label="Food Rescued" value={impact ? `${impact.food_rescued} kg` : "…"} tone="brand" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {supplySide ? (
            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide">My Inventory</h2>
                <Link to="/app/inventory" className="text-xs font-semibold text-brand-600 hover:underline">
                  Manage inventory →
                </Link>
              </div>
              <table className="data-table mt-3">
                <thead>
                  <tr><th>Food</th><th>Quantity</th><th>Risk</th></tr>
                </thead>
                <tbody>
                  {myInventory.length === 0 && (
                    <tr><td colSpan={3} className="text-muted">No inventory listed yet.</td></tr>
                  )}
                  {myInventory.map((i) => (
                    <tr key={i.id}>
                      <td className="font-medium">{i.food_item}</td>
                      <td>{i.quantity} {i.unit}</td>
                      <td><RiskBadge level={i.waste_risk} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {topWatch && myAtRisk.some((i) => i.id === topWatch.id) && (
                <div className="mt-4 rounded-lg border border-crit-200 bg-crit-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-crit-600">FoodFlow Recommends</div>
                  <p className="mt-1 text-sm text-ink">
                    "{topWatch.quantity} {topWatch.unit} {topWatch.food_item.toLowerCase()} may become waste within{" "}
                    {topWatch.time_remaining_label}."
                  </p>
                  <p className="text-sm text-ink/80">
                    {topWatch.destinations.length} nearby demand source(s) can absorb it.
                  </p>
                  <Link to="/app/waste-watch" className="btn-danger-outline mt-3 inline-block">Rescue Food</Link>
                </div>
              )}
            </section>
          ) : (
            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide">My Demand</h2>
                <Link to="/app/demand" className="text-xs font-semibold text-brand-600 hover:underline">
                  Manage demand →
                </Link>
              </div>
              <table className="data-table mt-3">
                <thead>
                  <tr><th>Food</th><th>Need</th><th>Received</th><th>Priority</th></tr>
                </thead>
                <tbody>
                  {myDemand.length === 0 && (
                    <tr><td colSpan={4} className="text-muted">No demand posted yet.</td></tr>
                  )}
                  {myDemand.map((d) => (
                    <tr key={d.id}>
                      <td className="font-medium">{d.food_item}</td>
                      <td>{d.quantity} kg</td>
                      <td>{d.quantity_received} kg</td>
                      <td><PriorityPill priority={d.priority} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {relevantMatches.length > 0 && (
                <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-brand-700">Local Matches Found</div>
                  <p className="mt-1 text-sm text-ink">
                    {relevantMatches[0].food_item} · {relevantMatches.length} supplier(s) · nearest{" "}
                    {Math.min(...relevantMatches.map((m) => m.distance_km)).toFixed(1)} km
                  </p>
                  <Link to="/app/matches" className="btn-primary mt-3 inline-block">Request Supply</Link>
                </div>
              )}
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">FoodFlow Signals</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="card p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-brand-600">Surplus Alert</div>
                {(signals?.surplus || []).slice(0, 3).map((s) => (
                  <p key={s.food_item} className="mt-2 text-sm text-ink/85">
                    <strong>{s.unallocated} kg {s.food_item.toLowerCase()}</strong> remains unallocated within the
                    local network ({s.matched_demand} kg matched demand nearby).
                  </p>
                ))}
                {!(signals?.surplus?.length) && <p className="mt-2 text-sm text-muted">No surplus imbalance right now.</p>}
                <Link to="/app/matches" className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:underline">
                  Find destinations →
                </Link>
              </div>
              <div className="card p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-crit-600">Shortage Alert</div>
                {(signals?.shortage || []).slice(0, 3).map((s) => (
                  <p key={s.food_item} className="mt-2 text-sm text-ink/85">
                    Estimated shortage of <strong>{s.shortfall} kg {s.food_item.toLowerCase()}</strong> — supply
                    currently covers only {s.covered_by_supply} kg of {s.demand} kg needed.
                  </p>
                ))}
                {!(signals?.shortage?.length) && <p className="mt-2 text-sm text-muted">No shortage imbalance right now.</p>}
                <Link to="/app/matches" className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:underline">
                  Find supply →
                </Link>
              </div>
            </div>
          </section>
        </div>

        <div>
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
