import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import FoodCard from "../components/FoodCard";
import { haversineKm } from "../utils/geo";

const OWNER_TYPES = ["all", "farmer", "producer", "supplier", "distributor", "market"];

export default function LocalFood() {
  const { currentUser, refreshKey } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [foodFilter, setFoodFilter] = useState("all");
  const [ownerType, setOwnerType] = useState("all");
  const [maxDistance, setMaxDistance] = useState(50);
  const [freshnessFilter, setFreshnessFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.getInventory().then((rows) => setItems(rows.filter((r) => r.quantity > 0))).catch(console.error);
  }, [refreshKey]);

  const withDistance = useMemo(() => {
    return items.map((i) => ({
      ...i,
      distance: currentUser ? haversineKm(currentUser.lat, currentUser.lng, i.lat, i.lng) : null,
    }));
  }, [items, currentUser]);

  const foodTypes = useMemo(() => ["all", ...new Set(items.map((i) => i.food_item))], [items]);

  const filtered = withDistance.filter((i) => {
    if (foodFilter !== "all" && i.food_item !== foodFilter) return false;
    if (ownerType !== "all" && i.owner_role !== ownerType) return false;
    if (i.distance != null && i.distance > maxDistance) return false;
    if (freshnessFilter !== "all" && i.waste_risk !== freshnessFilter) return false;
    return true;
  });

  filtered.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Local Food</h1>
        <p className="text-sm text-muted">Discover what's available across the Millbrook network right now.</p>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <select value={foodFilter} onChange={(e) => setFoodFilter(e.target.value)} className="input w-auto">
          {foodTypes.map((f) => <option key={f} value={f}>{f === "all" ? "All food types" : f}</option>)}
        </select>
        <select value={ownerType} onChange={(e) => setOwnerType(e.target.value)} className="input w-auto">
          {OWNER_TYPES.map((t) => <option key={t} value={t}>{t === "all" ? "All supplier types" : t}</option>)}
        </select>
        <select value={freshnessFilter} onChange={(e) => setFreshnessFilter(e.target.value)} className="input w-auto">
          <option value="all">Any freshness</option>
          <option value="LOW">Low risk</option>
          <option value="MEDIUM">Medium risk</option>
          <option value="HIGH">High risk</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-muted">
          Max distance: <strong className="text-ink">{maxDistance} km</strong>
          <input type="range" min="1" max="50" value={maxDistance} onChange={(e) => setMaxDistance(+e.target.value)} />
        </label>
        <span className="ml-auto text-xs text-muted">{filtered.length} listing(s)</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((item) => (
          <FoodCard key={item.id} item={item} distanceKm={item.distance} onView={setSelected} />
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted">No listings match these filters.</p>}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" onClick={() => setSelected(null)}>
          <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold">{selected.food_item}</h3>
              <button onClick={() => setSelected(null)} className="text-muted hover:text-ink">✕</button>
            </div>
            <p className="mt-1 text-sm text-muted">{selected.owner_name} · {selected.location_name}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>Quantity: <strong>{selected.quantity} {selected.unit}</strong></div>
              <div>Risk: <strong>{selected.waste_risk}</strong></div>
              <div>Shelf life left: <strong>{selected.time_remaining_label}</strong></div>
              <div>Distance: <strong>{selected.distance != null ? selected.distance.toFixed(1) + " km" : "-"}</strong></div>
            </div>
            <button
              className="btn-primary mt-4 w-full"
              onClick={() => navigate(`/app/matches?food_item=${encodeURIComponent(selected.food_item)}`)}
            >
              See Smart Matches for this item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
