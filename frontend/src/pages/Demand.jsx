import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useApp, isSupplyRole } from "../context/AppContext";
import PriorityPill from "../components/PriorityPill";

const CATEGORIES = ["vegetable", "fruit", "grain", "dairy", "other"];

function emptyForm() {
  return { food_item: "", category: "vegetable", quantity: "", needed_in_hours: 24, priority: "NORMAL", recurring: false };
}

export default function Demand() {
  const { currentUser, bump, refreshKey } = useApp();
  const [all, setAll] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState(null);
  const canManage = currentUser && !isSupplyRole(currentUser.role);

  const load = () => api.getDemand().then(setAll).catch(console.error);
  useEffect(() => { load(); }, [refreshKey]);

  const mine = all.filter((d) => currentUser && d.requester_id === currentUser.id);
  const network = all.filter((d) => !currentUser || d.requester_id !== currentUser.id);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (!form.food_item.trim()) throw new Error("Food item is required.");
      if (!form.quantity || Number(form.quantity) <= 0) throw new Error("Quantity must be greater than zero.");
      const neededBy = new Date(Date.now() + Number(form.needed_in_hours) * 3600000).toISOString();
      await api.createDemand({
        requester_id: currentUser.id,
        food_item: form.food_item,
        category: form.category,
        quantity: Number(form.quantity),
        needed_by: neededBy,
        location_id: currentUser.location_id,
        priority: form.priority,
        recurring: form.recurring,
      });
      setForm(emptyForm());
      bump();
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const markFulfilled = async (id) => {
    await api.updateDemand(id, { status: "fulfilled" });
    bump();
    load();
  };

  const remove = async (id) => {
    if (!confirm("Remove this demand request?")) return;
    await api.deleteDemand(id);
    bump();
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Demand</h1>
        <p className="text-sm text-muted">All open demand across the network, and your own requests.</p>
      </div>

      {canManage && (
        <form onSubmit={submit} className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-6">
          <input required placeholder="Food item" value={form.food_item}
            onChange={(e) => setForm({ ...form, food_item: e.target.value })} className="input col-span-2" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input required type="number" min="0.1" step="0.1" placeholder="Quantity (kg)" value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="input" />
          <input required type="number" min="1" placeholder="Needed within (hours)" value={form.needed_in_hours}
            onChange={(e) => setForm({ ...form, needed_in_hours: e.target.value })} className="input" />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input">
            {["LOW", "NORMAL", "HIGH", "CRITICAL"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <label className="col-span-2 flex items-center gap-2 text-sm md:col-span-6">
            <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />
            Recurring demand
          </label>
          <div className="col-span-2 md:col-span-6">
            <button className="btn-primary">Post demand</button>
          </div>
          {error && <p className="col-span-2 text-xs font-medium text-crit-500 md:col-span-6">{error}</p>}
        </form>
      )}

      {canManage && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">My Requests</h2>
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Food</th><th>Need</th><th>Received</th><th>Priority</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {mine.length === 0 && <tr><td colSpan={6} className="text-muted">No requests yet.</td></tr>}
                {mine.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.food_item}{d.recurring ? " ↻" : ""}</td>
                    <td>{d.quantity} kg</td>
                    <td>{d.quantity_received} kg</td>
                    <td><PriorityPill priority={d.priority} /></td>
                    <td className="text-muted">{d.status}</td>
                    <td className="text-right">
                      {d.status === "open" && (
                        <button onClick={() => markFulfilled(d.id)} className="mr-2 text-xs font-semibold text-brand-600 hover:underline">
                          Mark fulfilled
                        </button>
                      )}
                      <button onClick={() => remove(d.id)} className="text-xs font-semibold text-crit-500 hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Network Demand</h2>
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Food</th><th>Requester</th><th>Need</th><th>Received</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>
              {network.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium">{d.food_item}{d.recurring ? " ↻" : ""}</td>
                  <td>{d.requester_name}</td>
                  <td>{d.quantity} kg</td>
                  <td>{d.quantity_received} kg</td>
                  <td><PriorityPill priority={d.priority} /></td>
                  <td className="text-muted">{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
