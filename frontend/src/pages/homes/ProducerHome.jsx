import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import { useApp } from "../../context/AppContext";
import RiskBadge from "../../components/RiskBadge";
import TransactionList from "../../components/TransactionList";
import TransactionDetail from "../../components/TransactionDetail";

export default function ProducerHome() {
  const { currentUser, refreshKey } = useApp();
  const [inventory, setInventory] = useState([]);
  const [matches, setMatches] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [openTx, setOpenTx] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!currentUser) return Promise.resolve();
    return Promise.all([
      api.getInventory(currentUser.id),
      api.getMatches({ top_n: 40 }),
      api.getUsers("distributor"),
      api.getTransactions({ producer_id: currentUser.id }),
    ])
      .then(([inv, allMatches, dist, txs]) => {
        setInventory(inv);
        const mine = new Set(inv.map((i) => i.id));
        setMatches(allMatches.filter((m) => mine.has(m.inventory_id)));
        setDistributors(dist);
        setTransactions(txs);
      })
      .catch(console.error);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [currentUser, refreshKey]);

  if (loading) return <p className="text-sm text-muted">Loading your food network…</p>;

  const available = inventory.filter((i) => i.status === "available");
  const availableQty = Math.round(available.reduce((s, i) => s + i.available_qty, 0));
  const atRisk = available.filter((i) => ["CRITICAL", "HIGH"].includes(i.waste_risk));
  const atRiskQty = Math.round(atRisk.reduce((s, i) => s + i.available_qty, 0));
  const activeTx = transactions.filter((t) => t.status !== "delivered");
  const nearbyDemandCount = new Set(matches.map((m) => m.demand_id)).size;

  // Rank recommendations: rescue-worthy (at risk) first, then best plain matches.
  const recommendations = [...matches]
    .sort((a, b) => {
      const riskRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const ra = riskRank[a.waste_risk] ?? 4;
      const rb = riskRank[b.waste_risk] ?? 4;
      if (ra !== rb) return ra - rb;
      return b.match_score - a.match_score;
    })
    .slice(0, 2);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-tight">Your food. Your nearby demand.</h1>
        <p className="mt-1 text-sm text-ink/60">{currentUser.name} · Producer</p>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line">
        <div className="bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Available</div>
          <div className="mt-1 text-2xl font-bold">{availableQty} kg</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">At risk</div>
          <div className={`mt-1 text-2xl font-bold ${atRiskQty > 0 ? "text-crit-500" : ""}`}>{atRiskQty} kg</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Nearby demand</div>
          <div className="mt-1 text-2xl font-bold text-brand-600">{nearbyDemandCount} match{nearbyDemandCount === 1 ? "" : "es"}</div>
        </div>
      </div>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">FoodFlow Recommends</h2>
        {recommendations.length === 0 && (
          <p className="panel mt-2 p-4 text-sm text-muted">
            No recommendations right now — list some food, or check back once nearby demand appears.
          </p>
        )}
        <div className="mt-2 space-y-3">
          {recommendations.map((m) => {
            const urgent = ["CRITICAL", "HIGH"].includes(m.waste_risk);
            return (
              <div key={m.id} className={`panel p-4 ${urgent ? "border-l-4 border-l-crit-500" : "border-l-4 border-l-brand-500"}`}>
                <div className="flex items-center gap-2">
                  <span className={`tag ${urgent ? "bg-crit-50 text-crit-600" : "bg-brand-50 text-brand-700"}`}>
                    {urgent ? "Urgent" : "Demand found"}
                  </span>
                  <RiskBadge level={m.waste_risk} />
                </div>
                <p className="mt-2 text-[15px] leading-snug text-ink">
                  <strong>{m.quantity} kg {m.food_item.toLowerCase()}</strong>
                  {urgent && <> · {m.hours_left}h remaining</>}
                </p>
                <p className="text-sm text-ink/70">
                  {m.requester_name} needs {m.quantity} kg · {m.distance_km} km away · {m.match_score}% match
                </p>
                <Link
                  to="/app/find-demand"
                  className={urgent ? "btn-danger-outline mt-3 inline-block" : "btn-primary mt-3 inline-block"}
                >
                  {urgent ? "Rescue food" : "View match"}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">Food on its way out</h2>
        <TransactionList
          transactions={activeTx}
          perspective="producer"
          onOpen={setOpenTx}
          emptyText="Nothing is in motion yet. Offer food to a nearby buyer under Find Demand."
        />
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">My Food</h2>
          <Link to="/app/my-food" className="text-xs font-semibold text-brand-600 hover:underline">Manage my food →</Link>
        </div>
        <div className="panel mt-2 overflow-hidden">
          <table className="data-table">
            <thead><tr><th>Food</th><th>Available</th><th>Reserved</th><th>Risk</th></tr></thead>
            <tbody>
              {inventory.length === 0 && <tr><td colSpan={4} className="text-muted">Nothing listed yet.</td></tr>}
              {inventory.slice(0, 5).map((i) => (
                <tr key={i.id}>
                  <td className="font-medium">{i.food_item}</td>
                  <td>{i.available_qty} {i.unit}</td>
                  <td className={i.reserved_qty > 0 ? "font-medium text-amber-700" : "text-ink/40"}>
                    {i.reserved_qty > 0 ? `${i.reserved_qty} ${i.unit}` : "—"}
                  </td>
                  <td><RiskBadge level={i.waste_risk} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">Available Distributors</h2>
          <Link to="/app/distribution" className="text-xs font-semibold text-brand-600 hover:underline">See all →</Link>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {distributors.slice(0, 3).map((d) => (
            <div key={d.id} className="panel p-3.5">
              <div className="font-semibold">{d.name}</div>
              <div className="text-xs text-ink/50">
                {d.vehicle_type ? `${d.vehicle_type} · ${d.capacity_kg} kg · ${d.service_area_km} km` : d.location_name}
              </div>
            </div>
          ))}
        </div>
      </section>

      {openTx && (
        <TransactionDetail transactionId={openTx} onClose={() => setOpenTx(null)} onChanged={load} />
      )}
    </div>
  );
}
