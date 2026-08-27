import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import RiskBadge from "../components/RiskBadge";
import { RISK_STYLES } from "../utils/format";

function clockPercent(hoursRemaining, totalShelfHours) {
  if (!totalShelfHours) return 0;
  return Math.max(0, Math.min(100, (hoursRemaining / totalShelfHours) * 100));
}

function RescueClock({ item }) {
  const pct = clockPercent(item.hours_remaining, item.shelf_life_hours);
  const style = RISK_STYLES[item.waste_risk] || RISK_STYLES.LOW;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-base font-bold">{item.food_item}</div>
          <div className="text-xs text-muted">{item.owner_name} · {item.available_qty} {item.unit}</div>
        </div>
        <RiskBadge level={item.waste_risk} />
      </div>
      <div className="mt-3 font-mono text-2xl font-extrabold text-ink">{item.time_remaining_label}</div>
      <div className="risk-bar mt-2">
        <div style={{ width: `${pct}%`, background: style.bar }} />
      </div>
    </div>
  );
}

export default function WasteWatch() {
  const { refreshKey, bump } = useApp();
  const [watch, setWatch] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = () => api.getWasteRisk().then((d) => setWatch(d.watch)).catch(console.error);
  useEffect(() => { load(); }, [refreshKey]);

  const rescue = async (matchId) => {
    setBusyId(matchId);
    setError(null);
    try {
      // Opens a transaction (reserves the food); a distributor still has
      // to move it before it counts as rescued.
      await api.acceptMatch(matchId, null, "producer");
      bump();
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Waste Watch</h1>
        <p className="text-sm text-muted">Food Rescue Clock — perishable inventory ranked by how soon it spoils.</p>
      </div>

      {error && <div className="card border-crit-200 bg-crit-50 p-3 text-sm text-crit-600">{error}</div>}

      {watch.length === 0 && (
        <div className="card p-6 text-center text-sm text-muted">
          Nothing is currently at high risk of waste. Try the "Food Spoilage" what-if scenario, or move the clock forward.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {watch.map((item) => <RescueClock key={item.id} item={item} />)}
      </div>

      {watch.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Rescue Recommendations</h2>
          {watch.map((item) => (
            <div key={item.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold">{item.food_item}</span>
                  <span className="ml-2 text-sm text-muted">{item.available_qty} {item.unit} · {item.time_remaining_label} remaining</span>
                </div>
                <RiskBadge level={item.waste_risk} />
              </div>
              {item.destinations.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No matching demand found nearby for this item yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {item.destinations.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-md bg-paper px-3 py-2 text-sm">
                      <span>
                        <strong>{d.requester_name}</strong> · {d.quantity} kg · {d.distance_km} km ·{" "}
                        <span className="font-mono font-semibold text-brand-600">{d.match_score}%</span>
                      </span>
                      <button
                        disabled={busyId === d.id}
                        onClick={() => rescue(d.id)}
                        className="btn-danger-outline"
                      >
                        {busyId === d.id ? "Reserving…" : "Send here"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
