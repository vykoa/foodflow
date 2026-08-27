import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import MatchCard from "../components/MatchCard";

export default function SmartMatches() {
  const { refreshKey } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const foodItem = searchParams.get("food_item") || "";
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getMatches({ top_n: 30, ...(foodItem ? { food_item: foodItem } : {}) })
      .then(setMatches)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [refreshKey, foodItem]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">FoodFlow found</h1>
          <p className="text-sm text-ink/60">
            Supply matched to nearby demand, scored 0-100% by the matching engine.
          </p>
        </div>
        {foodItem && (
          <button onClick={() => setSearchParams({})} className="btn-secondary">
            Clear filter: {foodItem} ✕
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-muted">Calculating matches…</p>}
      {!loading && matches.length === 0 && (
        <div className="card p-6 text-center text-sm text-muted">
          No viable matches right now — either supply and demand are balanced, or nothing overlaps on food type.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} onResolved={load} />
        ))}
      </div>
    </div>
  );
}
