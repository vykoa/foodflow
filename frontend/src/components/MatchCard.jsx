import { useState } from "react";
import RiskBadge from "./RiskBadge";
import PriorityPill from "./PriorityPill";
import WhyMatchModal from "./WhyMatchModal";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";

function scoreTone(score) {
  if (score >= 80) return "text-brand-600";
  if (score >= 55) return "text-amber-600";
  return "text-crit-500";
}

export default function MatchCard({ match, onResolved }) {
  const { bump } = useApp();
  const [showWhy, setShowWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const act = async (action) => {
    setBusy(true);
    setError(null);
    try {
      if (action === "accept") await api.acceptMatch(match.id);
      else await api.rejectMatch(match.id);
      bump();
      onResolved?.(match.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-bold text-ink">{match.food_item}</div>
          <div className="mt-0.5 text-sm text-muted">
            {match.supplier_name} <span className="mx-1 text-line">→</span> {match.requester_name}
          </div>
        </div>
        <div className={`text-right font-mono font-extrabold ${scoreTone(match.match_score)}`}>
          <div className="text-2xl leading-none">{match.match_score}%</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">match</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <RiskBadge level={match.waste_risk} />
        <PriorityPill priority={match.priority || "NORMAL"} />
        {match.delayed_route && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            ROUTE DELAYED
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-paper p-2.5 text-center text-xs">
        <div>
          <div className="font-bold text-ink">{match.quantity} kg</div>
          <div className="text-muted">quantity</div>
        </div>
        <div>
          <div className="font-bold text-ink">{match.distance_km} km</div>
          <div className="text-muted">distance</div>
        </div>
        <div>
          <div className="font-bold text-ink">{match.hours_left}h</div>
          <div className="text-muted">shelf life</div>
        </div>
      </div>

      {error && <div className="mt-2 text-xs font-medium text-crit-500">{error}</div>}

      <div className="mt-3 flex items-center gap-2">
        <button disabled={busy} onClick={() => act("accept")} className="btn-primary flex-1">
          Accept
        </button>
        <button disabled={busy} onClick={() => act("reject")} className="btn-secondary flex-1">
          Reject
        </button>
        <button onClick={() => setShowWhy(true)} className="btn-secondary whitespace-nowrap">
          Why this match?
        </button>
      </div>

      {showWhy && <WhyMatchModal match={match} onClose={() => setShowWhy(false)} />}
    </div>
  );
}
