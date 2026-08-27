import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import { useApp } from "../../context/AppContext";
import MoveRow from "../../components/MoveRow";
import TransactionDetail from "../../components/TransactionDetail";

export default function DistributorHome() {
  const { currentUser, refreshKey } = useApp();
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [profile, setProfile] = useState(null);
  const [openTx, setOpenTx] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!currentUser) return Promise.resolve();
    return Promise.all([
      api.getTransactions({ status: "distributor_needed" }),
      api.getTransactions({ distributor_id: currentUser.id }),
      api.getProfile(currentUser.id),
    ])
      .then(([avail, my, prof]) => {
        setAvailable(avail);
        setMine(my);
        setProfile(prof);
      })
      .catch(console.error);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [currentUser, refreshKey]);

  if (loading) return <p className="text-sm text-muted">Loading available deliveries…</p>;

  // A distributor only sees what its vehicle and service area can support.
  const canSupport = (m) =>
    (!profile?.capacity_kg || m.quantity <= profile.capacity_kg) &&
    (!profile?.service_area_km || m.distance_km <= profile.service_area_km);

  const supportable = available.filter(canSupport);
  const outOfRange = available.length - supportable.length;
  const urgent = supportable.filter((m) => ["CRITICAL", "HIGH"].includes(m.inventory_waste_risk));
  const activeMine = mine.filter((m) => m.status !== "delivered");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-tight">Move food where it matters.</h1>
        <p className="mt-1 text-sm text-ink/60">
          {currentUser.name}
          {profile?.vehicle_type && <> · {profile.vehicle_type} · {profile.capacity_kg} kg · {profile.service_area_km} km radius</>}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line">
        <div className="bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Available deliveries</div>
          <div className="mt-1 text-2xl font-bold">{supportable.length}</div>
          {outOfRange > 0 && (
            <div className="mt-0.5 text-[11px] text-ink/45">{outOfRange} outside your capacity</div>
          )}
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Urgent</div>
          <div className={`mt-1 text-2xl font-bold ${urgent.length > 0 ? "text-crit-500" : ""}`}>{urgent.length}</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Active</div>
          <div className="mt-1 text-2xl font-bold text-brand-600">{activeMine.length}</div>
        </div>
      </div>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">Urgent deliveries</h2>
        {urgent.length === 0 && (
          <p className="panel mt-2 p-4 text-sm text-muted">
            Nothing urgent right now — see all available deliveries below.
          </p>
        )}
        <div className="mt-2 space-y-2.5">
          {urgent.slice(0, 3).map((m) => (
            <MoveRow key={m.id} move={m} onOpen={setOpenTx} onChanged={load} urgent />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">My active deliveries</h2>
          <Link to="/app/my-moves" className="text-xs font-semibold text-brand-600 hover:underline">See all →</Link>
        </div>
        {activeMine.length === 0 ? (
          <p className="panel mt-2 p-4 text-sm text-muted">You haven't accepted any deliveries yet.</p>
        ) : (
          <div className="mt-2 space-y-2.5">
            {activeMine.slice(0, 4).map((m) => (
              <MoveRow key={m.id} move={m} onOpen={setOpenTx} onChanged={load} />
            ))}
          </div>
        )}
      </section>

      <div className="text-right">
        <Link to="/app/available-moves" className="text-xs font-semibold text-brand-600 hover:underline">
          See all available deliveries →
        </Link>
      </div>

      {openTx && (
        <TransactionDetail transactionId={openTx} onClose={() => setOpenTx(null)} onChanged={load} />
      )}
    </div>
  );
}
