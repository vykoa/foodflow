import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import { useApp } from "../../context/AppContext";
import RiskBadge from "../../components/RiskBadge";
import { getMyMoves, recordMove } from "../../utils/myMoves";

export default function DistributorHome() {
  const { currentUser, refreshKey, bump } = useApp();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const myMoves = currentUser ? getMyMoves(currentUser.id) : [];

  useEffect(() => {
    setLoading(true);
    api.getMatches({ top_n: 40 }).then(setMatches).catch(console.error).finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <p className="text-sm text-muted">Loading the network…</p>;

  const urgent = matches.filter((m) => ["CRITICAL", "HIGH"].includes(m.waste_risk));

  const acceptDelivery = async (m) => {
    setBusyId(m.id);
    setError(null);
    try {
      await api.acceptMatch(m.id);
      recordMove(currentUser.id, {
        id: m.id,
        food_item: m.food_item,
        from: m.supplier_name,
        to: m.requester_name,
        quantity: m.quantity,
        distance_km: m.distance_km,
      });
      bump();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-tight">Move food where it matters.</h1>
        <p className="mt-1 text-sm text-ink/60">{currentUser.name} · Distributor</p>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line">
        <div className="bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Available moves</div>
          <div className="mt-1 text-2xl font-bold">{matches.length}</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Urgent</div>
          <div className={`mt-1 text-2xl font-bold ${urgent.length > 0 ? "text-crit-500" : ""}`}>{urgent.length}</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Active</div>
          <div className="mt-1 text-2xl font-bold text-brand-600">{myMoves.length}</div>
        </div>
      </div>

      {error && <div className="panel border-crit-200 bg-crit-50 p-3 text-sm text-crit-600">{error}</div>}

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">Urgent Movements</h2>
        {urgent.length === 0 && (
          <p className="panel mt-2 p-4 text-sm text-muted">Nothing urgent right now — check Available Moves for the full list.</p>
        )}
        <div className="mt-2 space-y-3">
          {urgent.slice(0, 3).map((m) => (
            <div key={m.id} className="panel flex items-center justify-between gap-4 border-l-4 border-l-crit-500 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{m.supplier_name}</span>
                  <span className="text-ink/30">→</span>
                  <span className="font-semibold">{m.requester_name}</span>
                  <RiskBadge level={m.waste_risk} />
                </div>
                <p className="mt-1 text-sm text-ink/70">
                  {m.quantity} kg {m.food_item.toLowerCase()} · {m.distance_km} km · {m.hours_left}h remaining
                </p>
              </div>
              <button
                disabled={busyId === m.id}
                onClick={() => acceptDelivery(m)}
                className="btn-danger-outline whitespace-nowrap"
              >
                {busyId === m.id ? "Accepting…" : "Accept delivery"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">My Active Movements</h2>
          <Link to="/app/my-moves" className="text-xs font-semibold text-brand-600 hover:underline">See all →</Link>
        </div>
        <div className="panel mt-2 overflow-hidden">
          <table className="data-table">
            <thead><tr><th>Food</th><th>From</th><th>To</th><th>Quantity</th></tr></thead>
            <tbody>
              {myMoves.length === 0 && <tr><td colSpan={4} className="text-muted">No movements accepted yet this session.</td></tr>}
              {myMoves.slice(0, 5).map((m, i) => (
                <tr key={i}>
                  <td className="font-medium">{m.food_item}</td>
                  <td>{m.from}</td>
                  <td>{m.to}</td>
                  <td>{m.quantity} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-right">
        <Link to="/app/available-moves" className="text-xs font-semibold text-brand-600 hover:underline">
          See all available moves →
        </Link>
      </div>
    </div>
  );
}
