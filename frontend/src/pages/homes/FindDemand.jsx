import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { useApp } from "../../context/AppContext";
import RiskBadge from "../../components/RiskBadge";
import PriorityPill from "../../components/PriorityPill";
import TransactionDetail from "../../components/TransactionDetail";

// A producer's view: for each thing I have, who nearby needs it, and
// what happens if I offer it to them.
export default function FindDemand() {
  const { currentUser, refreshKey, bump } = useApp();
  const [inventory, setInventory] = useState([]);
  const [matches, setMatches] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [openTx, setOpenTx] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!currentUser) return Promise.resolve();
    return Promise.all([api.getInventory(currentUser.id), api.getMatches({ top_n: 60 })])
      .then(([inv, all]) => {
        setInventory(inv.filter((i) => i.available_qty > 0));
        const mine = new Set(inv.map((i) => i.id));
        setMatches(all.filter((m) => mine.has(m.inventory_id)));
      })
      .catch(console.error);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [currentUser, refreshKey]);

  const offer = async (match) => {
    setBusyId(match.id);
    setError(null);
    try {
      const tx = await api.acceptMatch(match.id, match.quantity, "producer");
      bump();
      await load();
      setOpenTx(tx.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="text-sm text-muted">Looking for nearby demand…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Find demand</h1>
        <p className="mt-1 text-sm text-ink/60">
          Who nearby needs what you're holding — and how urgently.
        </p>
      </div>

      {error && <div className="panel border-crit-200 bg-crit-50 p-3 text-sm text-crit-600">{error}</div>}

      {inventory.length === 0 && (
        <p className="panel p-6 text-center text-sm text-muted">
          You have no available food listed. Add some under <strong>My Food</strong>.
        </p>
      )}

      <div className="space-y-3">
        {inventory.map((item) => {
          const forItem = matches
            .filter((m) => m.inventory_id === item.id)
            .sort((a, b) => b.match_score - a.match_score);
          const isOpen = expanded === item.id;
          return (
            <div key={item.id} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{item.food_item}</span>
                    <RiskBadge level={item.waste_risk} />
                  </div>
                  <p className="mt-0.5 text-sm text-ink/70">
                    {item.available_qty} {item.unit} available · {item.time_remaining_label} remaining ·{" "}
                    <strong>{forItem.length}</strong> potential buyer{forItem.length === 1 ? "" : "s"} nearby
                    {item.reserved_qty > 0 && <> · {item.reserved_qty} {item.unit} reserved</>}
                  </p>
                </div>
                <button
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className={forItem.length ? "btn-primary" : "btn-secondary"}
                  disabled={!forItem.length}
                >
                  {forItem.length === 0 ? "No demand yet" : isOpen ? "Hide" : "Find a use"}
                </button>
              </div>

              {isOpen && forItem.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink/50">
                    FoodFlow found
                  </div>
                  <div className="space-y-2">
                    {forItem.map((m) => (
                      <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded bg-paper px-3 py-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{m.requester_name}</span>
                            <PriorityPill priority={m.priority} />
                            {m.prefer_local && (
                              <span className="tag bg-brand-50 text-brand-700">Preferred · local</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-ink/70">
                            needs {m.quantity} {item.unit} · {m.distance_km} km ·{" "}
                            <span className="font-semibold text-brand-600">{m.match_score}% match</span>
                          </p>
                        </div>
                        <button
                          disabled={busyId === m.id}
                          onClick={() => offer(m)}
                          className="btn-primary whitespace-nowrap"
                        >
                          {busyId === m.id ? "Offering…" : `Offer ${m.quantity} ${item.unit}`}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {openTx && (
        <TransactionDetail transactionId={openTx} onClose={() => setOpenTx(null)} onChanged={load} />
      )}
    </div>
  );
}
