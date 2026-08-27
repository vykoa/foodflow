import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { useApp } from "../../context/AppContext";
import ProfileCard from "../../components/ProfileCard";
import TransactionList from "../../components/TransactionList";
import TransactionDetail from "../../components/TransactionDetail";

export default function ProducerDistribution() {
  const { currentUser, refreshKey } = useApp();
  const [distributors, setDistributors] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [openProfile, setOpenProfile] = useState(null);
  const [openTx, setOpenTx] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!currentUser) return Promise.resolve();
    return Promise.all([
      api.getUsers("distributor"),
      api.getTransactions({ producer_id: currentUser.id }),
    ])
      .then(([dist, txs]) => { setDistributors(dist); setTransactions(txs); })
      .catch(console.error);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [currentUser, refreshKey]);

  const active = transactions.filter((t) => t.status !== "delivered");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Distribution</h1>
        <p className="mt-1 text-sm text-ink/60">
          Who is moving your food, and which partners can carry it.
        </p>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">Your food in motion</h2>
        <TransactionList
          transactions={active}
          perspective="producer"
          onOpen={setOpenTx}
          emptyText="Nothing is in motion. Offer food to a nearby buyer under Find Demand."
        />
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">Distribution partners</h2>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {distributors.map((d) => (
            <button key={d.id} onClick={() => setOpenProfile(d.id)} className="panel p-4 text-left transition hover:border-brand-300">
              <div className="font-semibold">{d.name}</div>
              <div className="text-xs text-ink/50">{d.location_name}</div>
              {d.vehicle_type && (
                <div className="mt-2 text-sm text-ink/70">
                  {d.vehicle_type} · {d.capacity_kg} kg · {d.service_area_km} km radius
                </div>
              )}
            </button>
          ))}
          {!loading && distributors.length === 0 && (
            <p className="text-sm text-muted">No distributors are registered on the network yet.</p>
          )}
        </div>
      </section>

      {openProfile && <ProfileCard userId={openProfile} onClose={() => setOpenProfile(null)} />}
      {openTx && <TransactionDetail transactionId={openTx} onClose={() => setOpenTx(null)} onChanged={load} />}
    </div>
  );
}
