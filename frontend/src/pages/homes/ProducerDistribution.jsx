import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { useApp } from "../../context/AppContext";

export default function ProducerDistribution() {
  const { refreshKey } = useApp();
  const [distributors, setDistributors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getUsers("distributor")
      .then(async (dist) => {
        const withLoad = await Promise.all(
          dist.map(async (d) => {
            const inv = await api.getInventory(d.id);
            const handling = inv.filter((i) => i.quantity > 0).reduce((s, i) => s + i.quantity, 0);
            return { ...d, handling: Math.round(handling) };
          })
        );
        setDistributors(withLoad);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Distribution</h1>
        <p className="mt-1 text-sm text-ink/60">Distribution partners who can move your food further.</p>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {distributors.map((d) => (
          <div key={d.id} className="panel p-4">
            <div className="font-semibold">{d.name}</div>
            <div className="text-xs text-ink/50">{d.location_name}</div>
            <div className="mt-2 text-sm text-ink/70">Currently handling {d.handling} kg</div>
          </div>
        ))}
        {!loading && distributors.length === 0 && (
          <p className="text-sm text-muted">No distributors are registered on the network yet.</p>
        )}
      </div>
    </div>
  );
}
