import { useState } from "react";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import RiskBadge from "./RiskBadge";
import TransactionProgress from "./TransactionProgress";

// One movement in a distributor's list: the route, the load, and the
// single next action appropriate to its current stage.
export default function MoveRow({ move, onOpen, onChanged, urgent = false }) {
  const { currentUser, bump } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      bump();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const isMine = move.distributor_id === currentUser?.id;
  const next =
    move.status === "distributor_needed"
      ? { label: "Accept delivery", fn: () => api.assignDistributor(move.id, currentUser.id) }
      : isMine && move.status === "distributor_assigned"
      ? { label: "Mark picked up", fn: () => api.pickupTransaction(move.id) }
      : isMine && move.status === "picked_up"
      ? { label: "Mark delivered", fn: () => api.deliverTransaction(move.id) }
      : null;

  return (
    <div className={`panel p-4 ${urgent ? "border-l-4 border-l-crit-500" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{move.producer_name}</span>
            <span className="text-ink/30">→</span>
            <span className="font-semibold">{move.buyer_name}</span>
            <RiskBadge level={move.inventory_waste_risk} />
          </div>
          <p className="mt-1 text-sm text-ink/70">
            {move.quantity} {move.unit} {move.food_item.toLowerCase()} · {move.distance_km} km ·{" "}
            {move.inventory_hours_remaining}h shelf life · ~{move.co2_avoided_kg ?? 0} kg CO₂ saved
          </p>
          <div className="mt-2 flex items-center gap-3">
            <TransactionProgress stages={move.progress} compact />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">
              {move.status_label}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => onOpen?.(move.id)} className="btn-secondary">Details</button>
          {next && (
            <button
              disabled={busy}
              onClick={() => act(next.fn)}
              className={urgent && move.status === "distributor_needed" ? "btn-danger-outline whitespace-nowrap" : "btn-primary whitespace-nowrap"}
            >
              {busy ? "Working…" : next.label}
            </button>
          )}
        </div>
      </div>
      {error && <div className="mt-2 text-xs font-medium text-crit-500">{error}</div>}
    </div>
  );
}
