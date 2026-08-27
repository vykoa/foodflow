import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot } from "recharts";
import { api } from "../services/api";
import { useApp, isSupplyRole } from "../context/AppContext";
import RiskBadge from "../components/RiskBadge";

const RISK_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, EXPIRED: -1 };

export default function Inventory() {
  const { currentUser, refreshKey } = useApp();
  const [items, setItems] = useState([]);
  const [sortBy, setSortBy] = useState("risk");
  const [forecasts, setForecasts] = useState([]);

  useEffect(() => {
    api.getInventory().then(setItems).catch(console.error);
    if (currentUser && !isSupplyRole(currentUser.role)) {
      api.getForecast(currentUser.id).then(setForecasts).catch(console.error);
    } else {
      setForecasts([]);
    }
  }, [currentUser, refreshKey]);

  const sorted = useMemo(() => {
    const copy = [...items];
    if (sortBy === "risk") copy.sort((a, b) => RISK_ORDER[a.waste_risk] - RISK_ORDER[b.waste_risk]);
    else if (sortBy === "quantity") copy.sort((a, b) => b.quantity - a.quantity);
    else if (sortBy === "expiry") copy.sort((a, b) => a.hours_remaining - b.hours_remaining);
    return copy;
  }, [items, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted">Every item in the network, annotated with live waste-risk.</p>
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input w-auto">
          <option value="risk">Sort by risk</option>
          <option value="expiry">Sort by time remaining</option>
          <option value="quantity">Sort by quantity</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Food</th><th>Owner</th><th>Category</th><th>Available</th><th>Reserved</th>
              <th>Time Remaining</th><th>Risk</th><th>Priority</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((i) => (
              <tr key={i.id}>
                <td className="font-medium">{i.food_item}</td>
                <td>{i.owner_name}{i.is_offline ? " (offline)" : ""}</td>
                <td className="text-muted">{i.category}</td>
                <td>{i.available_qty} {i.unit}</td>
                <td className={i.reserved_qty > 0 ? "font-medium text-amber-700" : "text-ink/40"}>
                  {i.reserved_qty > 0 ? `${i.reserved_qty} ${i.unit}` : "—"}
                </td>
                <td className="font-mono text-xs">{i.time_remaining_label}</td>
                <td><RiskBadge level={i.waste_risk} /></td>
                <td className="text-muted">{i.priority}</td>
                <td className="text-muted">{i.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {forecasts.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Demand Forecast</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {forecasts.map((f) => (
              <div key={f.food_item} className="card p-4">
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
