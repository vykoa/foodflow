import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useApp, isSupplyRole } from "../context/AppContext";
import RiskBadge from "../components/RiskBadge";

const CATEGORIES = ["vegetable", "fruit", "grain", "dairy", "other"];
const UNITS = ["kg", "litre", "unit", "crate"];

function emptyForm() {
  return { food_item: "", category: "vegetable", quantity: "", unit: "kg", shelf_life_hours: 48, priority: "NORMAL" };
}

export default function Supply() {
  const { currentUser, bump, refreshKey } = useApp();
  const [all, setAll] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const canManage = currentUser && isSupplyRole(currentUser.role);

  const load = () => api.getInventory().then(setAll).catch(console.error);
  useEffect(() => { load(); }, [refreshKey]);

  const mine = all.filter((i) => currentUser && i.owner_id === currentUser.id);
  const network = all.filter((i) => !currentUser || i.owner_id !== currentUser.id);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (!form.food_item.trim()) throw new Error("Food item is required.");
      if (!form.quantity || Number(form.quantity) <= 0) throw new Error("Quantity must be greater than zero.");
      if (!form.shelf_life_hours || Number(form.shelf_life_hours) <= 0) throw new Error("Shelf life must be greater than zero.");

      if (editing) {
        await api.updateInventory(editing, {
          food_item: form.food_item, category: form.category, quantity: Number(form.quantity),
          unit: form.unit, shelf_life_hours: Number(form.shelf_life_hours), priority: form.priority,
        });
      } else {
        await api.createInventory({
          owner_id: currentUser.id,
          food_item: form.food_item,
          category: form.category,
          quantity: Number(form.quantity),
          unit: form.unit,
          location_id: currentUser.location_id,
          available_date: new Date().toISOString(),
          shelf_life_hours: Number(form.shelf_life_hours),
          priority: form.priority,
        });
      }
      setForm(emptyForm());
      setEditing(null);
      bump();
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = (item) => {
    setEditing(item.id);
    setForm({
      food_item: item.food_item, category: item.category, quantity: item.quantity,
      unit: item.unit, shelf_life_hours: item.shelf_life_hours, priority: item.priority,
    });
  };

  const remove = async (id) => {
    if (!confirm("Remove this inventory listing?")) return;
    await api.deleteInventory(id);
    bump();
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Supply</h1>
        <p className="text-sm text-muted">All available supply across the network, and your own listings.</p>
      </div>

      {canManage && (
        <form onSubmit={submit} className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-6">
          <input required placeholder="Food item" value={form.food_item}
            onChange={(e) => setForm({ ...form, food_item: e.target.value })} className="input col-span-2" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input required type="number" min="0.1" step="0.1" placeholder="Quantity" value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="input" />
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input">
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <input required type="number" min="1" placeholder="Shelf life (hours)" value={form.shelf_life_hours}
            onChange={(e) => setForm({ ...form, shelf_life_hours: e.target.value })} className="input" />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input">
            {["LOW", "NORMAL", "HIGH", "CRITICAL"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="col-span-2 flex gap-2 md:col-span-6">
            <button className="btn-primary">{editing ? "Save changes" : "List supply"}</button>
            {editing && (
              <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm(emptyForm()); }}>
                Cancel
              </button>
            )}
          </div>
          {error && <p className="col-span-2 text-xs font-medium text-crit-500 md:col-span-6">{error}</p>}
        </form>
      )}

      {canManage && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">My Listings</h2>
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Food</th><th>Available</th><th>Reserved</th><th>Risk</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {mine.length === 0 && <tr><td colSpan={6} className="text-muted">No listings yet.</td></tr>}
                {mine.map((i) => (
                  <tr key={i.id}>
                    <td className="font-medium">{i.food_item}</td>
                    <td>{i.available_qty} {i.unit}</td>
                    <td className={i.reserved_qty > 0 ? "font-medium text-amber-700" : "text-ink/40"}>
                      {i.reserved_qty > 0 ? `${i.reserved_qty} ${i.unit}` : "—"}
                    </td>
                    <td><RiskBadge level={i.waste_risk} /></td>
                    <td className="text-muted">{i.status}</td>
                    <td className="space-x-2 text-right">
                      <button onClick={() => startEdit(i)} className="text-xs font-semibold text-brand-600 hover:underline">Edit</button>
                      <button onClick={() => remove(i.id)} className="text-xs font-semibold text-crit-500 hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Network Supply</h2>
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Food</th><th>Supplier</th><th>Available</th><th>Risk</th><th>Freshness</th></tr></thead>
            <tbody>
              {network.map((i) => (
                <tr key={i.id}>
                  <td className="font-medium">{i.food_item}</td>
                  <td>{i.owner_name}</td>
                  <td>{i.available_qty} {i.unit}</td>
                  <td><RiskBadge level={i.waste_risk} /></td>
                  <td className="text-muted">{i.time_remaining_label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
