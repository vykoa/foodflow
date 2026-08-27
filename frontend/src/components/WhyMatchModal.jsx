const LABELS = {
  urgency: "Demand urgency",
  shelf_life: "Shelf-life risk",
  proximity: "Proximity",
  quantity_fit: "Quantity fit",
  priority: "Priority",
  transport_efficiency: "Transport efficiency",
};

export default function WhyMatchModal({ match, onClose }) {
  if (!match) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Why this match?</div>
            <div className="text-3xl font-extrabold text-brand-600">{match.match_score}%</div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </div>

        <div className="mt-4 space-y-2">
          {Object.entries(match.weighted_breakdown || {}).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-ink/80">{LABELS[key] || key}</span>
              <span className="font-mono font-semibold text-brand-700">+{val}</span>
            </div>
          ))}
        </div>

        {match.explanation?.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <ul className="space-y-1.5">
              {match.explanation.map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink/85">
                  <span className="mt-0.5 text-brand-500">+</span>
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs text-muted">
          <div>Distance: <span className="font-medium text-ink">{match.distance_km} km</span></div>
          <div>Est. trips: <span className="font-medium text-ink">{match.transport?.estimated_trips}</span></div>
          <div>Est. CO2: <span className="font-medium text-ink">{match.transport?.estimated_co2} kg</span></div>
          <div>Quantity: <span className="font-medium text-ink">{match.quantity} kg</span></div>
        </div>
      </div>
    </div>
  );
}
