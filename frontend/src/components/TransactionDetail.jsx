import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useApp, getWorld, WORLDS } from "../context/AppContext";
import TransactionProgress from "./TransactionProgress";
import RiskBadge from "./RiskBadge";

const FACTOR_LABELS = {
  urgency: "Buyer urgency",
  shelf_life: "Shelf-life risk",
  proximity: "Proximity",
  quantity_fit: "Quantity fit",
  priority: "Buyer priority",
  transport_efficiency: "Transport efficiency",
};

// One clean view of a whole transaction: who had the food, who needed it,
// why they were matched, who is moving it, and where it is now.
export default function TransactionDetail({ transactionId, onClose, onChanged }) {
  const { currentUser, bump } = useApp();
  const [tx, setTx] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const world = currentUser ? getWorld(currentUser.role) : null;

  const load = () =>
    api.getTransaction(transactionId).then(setTx).catch((e) => setError(e.message));

  useEffect(() => { load(); }, [transactionId]);

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      bump();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!tx) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" onClick={onClose}>
        <div className="panel p-6 text-sm text-muted">{error || "Loading transaction…"}</div>
      </div>
    );
  }

  const isMyMove = tx.distributor_id === currentUser?.id;
  const canAccept = world === WORLDS.DISTRIBUTOR && tx.status === "distributor_needed";
  const canPickup = world === WORLDS.DISTRIBUTOR && isMyMove && tx.status === "distributor_assigned";
  const canDeliver = world === WORLDS.DISTRIBUTOR && isMyMove && tx.status === "picked_up";
  const rescue = ["CRITICAL", "HIGH"].includes(tx.inventory_waste_risk);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-10" onClick={onClose}>
      <div className="panel w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Transaction #{tx.id}</div>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              {tx.quantity} {tx.unit} {tx.food_item}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </div>

        {/* The physical chain of food through the network. */}
        <div className="mt-4 rounded border border-line bg-paper p-4">
          <div className="space-y-1 text-sm">
            <div className="font-semibold">{tx.producer_name}</div>
            <div className="pl-1 text-ink/30">↓</div>
            <div className={tx.distributor_name ? "font-semibold" : "italic text-ink/40"}>
              {tx.distributor_name || "Awaiting a distributor"}
            </div>
            <div className="pl-1 text-ink/30">↓</div>
            <div className="font-semibold">{tx.buyer_name}</div>
          </div>
        </div>

        {rescue && (
          <div className="mt-3 rounded border-l-4 border-l-crit-500 border border-crit-200 bg-crit-50 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-crit-600">Food rescue priority</div>
            <p className="mt-1 text-sm text-ink/80">
              FoodFlow is prioritising this movement because this food has{" "}
              <strong>{tx.inventory_hours_remaining}h</strong> of shelf life remaining.
            </p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Status</div>
            <div className="mt-1 text-sm font-bold">{tx.status_label}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Match</div>
            <div className="mt-1 text-sm font-bold text-brand-600">{Math.round(tx.match_score)}%</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Distance</div>
            <div className="mt-1 text-sm font-bold">{tx.distance_km} km</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Shelf life</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-bold">
              {tx.inventory_hours_remaining}h <RiskBadge level={tx.inventory_waste_risk} />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink/50">Journey</div>
          <TransactionProgress stages={tx.progress} />
        </div>

        <div className="mt-3 border-t border-line pt-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink/50">Why this match?</div>
          <div className="space-y-1">
            {Object.entries(tx.score_breakdown || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="text-ink/75">{FACTOR_LABELS[k] || k}</span>
                <span className="font-mono text-xs font-semibold text-brand-700">{Math.round(v)}</span>
              </div>
            ))}
          </div>
          {tx.explanation?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {tx.explanation.map((e, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink/80">
                  <span className="text-brand-500">+</span>{e}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <div className="mt-3 text-sm font-medium text-crit-500">{error}</div>}

        {(canAccept || canPickup || canDeliver) && (
          <div className="mt-4 flex gap-2 border-t border-line pt-4">
            {canAccept && (
              <button disabled={busy} onClick={() => act(() => api.assignDistributor(tx.id, currentUser.id))} className="btn-primary flex-1">
                {busy ? "Working…" : "Accept delivery"}
              </button>
            )}
            {canPickup && (
              <button disabled={busy} onClick={() => act(() => api.pickupTransaction(tx.id))} className="btn-primary flex-1">
                {busy ? "Working…" : "Mark picked up"}
              </button>
            )}
            {canDeliver && (
              <button disabled={busy} onClick={() => act(() => api.deliverTransaction(tx.id))} className="btn-primary flex-1">
                {busy ? "Working…" : "Mark delivered"}
              </button>
            )}
            {isMyMove && tx.status === "distributor_assigned" && (
              <button disabled={busy} onClick={() => act(() => api.declineTransaction(tx.id))} className="btn-secondary">
                Release
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
