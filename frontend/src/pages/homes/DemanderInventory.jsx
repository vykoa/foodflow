import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot } from "recharts";
import { api } from "../../services/api";
import { useApp } from "../../context/AppContext";
import PriorityPill from "../../components/PriorityPill";

export default function DemanderInventory() {
  const { currentUser, refreshKey } = useApp();
  const [demand, setDemand] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    Promise.all([api.getDemand(currentUser.id), api.getForecast(currentUser.id)])
      .then(([dem, fc]) => {
        setDemand(dem);
        setForecasts(fc);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentUser, refreshKey]);

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">My Inventory</h1>
        <p className="mt-1 text-sm text-ink/60">What you have on hand, and what's still outstanding.</p>
      </div>

      <div className="panel overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Food</th><th>Requested</th><th>On hand</th><th>Outstanding</th><th>Priority</th></tr></thead>
          <tbody>
            {demand.length === 0 && <tr><td colSpan={5} className="text-muted">No requests yet.</td></tr>}
            {demand.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">{d.food_item}</td>
                <td>{d.quantity} kg</td>
                <td>{d.quantity_received} kg</td>
                <td>{Math.max(d.quantity - d.quantity_received, 0)} kg</td>
                <td><PriorityPill priority={d.priority} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {forecasts.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/50">Upcoming Need (Forecast)</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {forecasts.map((f) => (
              <div key={f.food_item} className="panel p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">{f.food_item}</h3>
                  <span className="font-mono text-lg font-extrabold text-brand-600">
                    {f.forecast != null ? `${f.forecast} kg` : "-"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{f.explanation}</p>
                {f.history.length > 0 && (
                  <div className="mt-3 h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[...f.history, { date: "Forecast", quantity: null }]}>
                        <CartesianGrid stroke="#eeece5" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(-5)} />
                        <YAxis tick={{ fontSize: 10 }} width={30} />
                        <Tooltip />
                        <Line type="monotone" dataKey="quantity" stroke="#2f7d3f" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                        <ReferenceDot x="Forecast" y={f.forecast} r={5} fill="#c1841c" stroke="none" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
