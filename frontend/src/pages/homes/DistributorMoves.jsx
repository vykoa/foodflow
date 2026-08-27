import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { useApp } from "../../context/AppContext";
import MoveRow from "../../components/MoveRow";
import TransactionDetail from "../../components/TransactionDetail";

export default function DistributorMoves() {
  const { currentUser, refreshKey } = useApp();
  const [moves, setMoves] = useState([]);
  const [openTx, setOpenTx] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!currentUser) return Promise.resolve();
    return api.getTransactions({ distributor_id: currentUser.id }).then(setMoves).catch(console.error);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [currentUser, refreshKey]);

  const active = moves.filter((m) => m.status !== "delivered");
  const completed = moves.filter((m) => m.status === "delivered");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">My deliveries</h1>
        <p className="mt-1 text-sm text-ink/60">Deliveries you've accepted, in progress and completed.</p>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">In progress</h2>
        {!loading && active.length === 0 ? (
          <p className="panel mt-2 p-4 text-sm text-muted">
            Nothing in progress. Pick something up from Available deliveries.
          </p>
        ) : (
          <div className="mt-2 space-y-2.5">
            {active.map((m) => <MoveRow key={m.id} move={m} onOpen={setOpenTx} onChanged={load} />)}
          </div>
        )}
      </section>

      {completed.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">Completed</h2>
          <div className="panel mt-2 overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Food</th><th>From</th><th>To</th><th>Quantity</th><th>Distance</th></tr></thead>
              <tbody>
                {completed.map((m) => (
                  <tr key={m.id} className="cursor-pointer" onClick={() => setOpenTx(m.id)}>
                    <td className="font-medium">{m.food_item}</td>
                    <td>{m.producer_name}</td>
                    <td>{m.buyer_name}</td>
                    <td>{m.quantity} {m.unit}</td>
                    <td>{m.distance_km} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {openTx && (
        <TransactionDetail transactionId={openTx} onClose={() => setOpenTx(null)} onChanged={load} />
      )}
    </div>
  );
}
