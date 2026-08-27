import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { useApp } from "../../context/AppContext";
import MoveRow from "../../components/MoveRow";
import TransactionDetail from "../../components/TransactionDetail";

export default function AvailableMoves() {
  const { currentUser, refreshKey } = useApp();
  const [moves, setMoves] = useState([]);
  const [profile, setProfile] = useState(null);
  const [openTx, setOpenTx] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!currentUser) return Promise.resolve();
    return Promise.all([
      api.getTransactions({ status: "distributor_needed" }),
      api.getProfile(currentUser.id),
    ])
      .then(([m, p]) => { setMoves(m); setProfile(p); })
      .catch(console.error);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [currentUser, refreshKey]);

  const canSupport = (m) =>
    (!profile?.capacity_kg || m.quantity <= profile.capacity_kg) &&
    (!profile?.service_area_km || m.distance_km <= profile.service_area_km);

  const supportable = moves.filter(canSupport);
  const rest = moves.filter((m) => !canSupport(m));
  const shown = showAll ? moves : supportable;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Available deliveries</h1>
        <p className="mt-1 text-sm text-ink/60">
          Food that has been requested and is waiting for someone to move it.
          {profile?.capacity_kg && (
            <> Filtered to your {profile.capacity_kg} kg / {profile.service_area_km} km capacity.</>
          )}
        </p>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}

      {!loading && shown.length === 0 && (
        <p className="panel p-6 text-center text-sm text-muted">
          No deliveries are waiting right now. When a buyer requests food, it appears here.
        </p>
      )}

      <div className="space-y-2.5">
        {shown.map((m) => (
          <MoveRow
            key={m.id}
            move={m}
            onOpen={setOpenTx}
            onChanged={load}
            urgent={["CRITICAL", "HIGH"].includes(m.inventory_waste_risk)}
          />
        ))}
      </div>

      {!showAll && rest.length > 0 && (
        <button onClick={() => setShowAll(true)} className="text-xs font-semibold text-brand-600 hover:underline">
          Show {rest.length} delivery(s) outside your capacity →
        </button>
      )}

      {openTx && (
        <TransactionDetail transactionId={openTx} onClose={() => setOpenTx(null)} onChanged={load} />
      )}
    </div>
  );
}
