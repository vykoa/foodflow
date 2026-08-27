import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import RiskBadge from "./RiskBadge";

// ONE view for "I clicked a listing and want some of it". No hop through
// Smart Matches: pick a quantity, request it, done.
export default function SupplyListingDetail({ item, distanceKm, onClose, onRequested }) {
  const { currentUser, bump } = useApp();
  const [myDemand, setMyDemand] = useState([]);
  const [demandId, setDemandId] = useState("");
  const [qty, setQty] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    api.getDemand(currentUser.id)
      .then((rows) => {
        // Only open requests for this same food can receive this listing.
        const matching = rows.filter(
          (d) => d.status === "open" &&
                 d.food_item.toLowerCase() === item.food_item.toLowerCase() &&
                 d.quantity - d.quantity_received > 0
        );
        setMyDemand(matching);
        if (matching.length) setDemandId(String(matching[0].id));
      })
      .catch((e) => setError(e.message));
  }, [currentUser, item]);

  const selectedDemand = myDemand.find((d) => String(d.id) === String(demandId));
  const outstanding = selectedDemand
    ? Math.max(selectedDemand.quantity - selectedDemand.quantity_received, 0)
    : 0;
  const maxQty = useMemo(
    () => Math.min(item.available_qty ?? item.quantity, outstanding || (item.available_qty ?? item.quantity)),
    [item, outstanding]
  );

  useEffect(() => {
    setQty(Math.round(maxQty));
  }, [maxQty]);

  const step = (delta) => {
    setQty((q) => Math.max(1, Math.min(Math.round(maxQty), q + delta)));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const tx = await api.requestSupply({
        inventory_id: item.id,
        demand_id: Number(demandId),
        quantity: Number(qty),
      });
      setDone(tx);
      bump();
      onRequested?.(tx);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const available = item.available_qty ?? item.quantity;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-10" onClick={onClose}>
      <div className="panel w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">{item.food_item}</h2>
            <p className="text-sm text-ink/60">{item.owner_name}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </div>

        {done ? (
          <div className="mt-5">
            <div className="rounded border-l-4 border-l-brand-500 border border-brand-200 bg-brand-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-brand-700">Request placed</div>
              <p className="mt-1 text-sm text-ink/80">
                <strong>{done.quantity} {done.unit} {done.food_item}</strong> reserved from {done.producer_name}.
              </p>
              <p className="mt-1 text-sm text-ink/80">Status: <strong>{done.status_label}</strong> — a distributor now needs to pick this up.</p>
            </div>
            <button onClick={onClose} className="btn-primary mt-4 w-full">Done</button>
          </div>
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Available</dt>
                <dd className="mt-0.5 text-sm font-bold">{available} {item.unit}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Distance</dt>
                <dd className="mt-0.5 text-sm font-bold">{distanceKm != null ? `${distanceKm.toFixed(1)} km` : "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Freshness</dt>
                <dd className="mt-0.5 text-sm font-bold">{item.time_remaining_label}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Waste risk</dt>
                <dd className="mt-0.5"><RiskBadge level={item.waste_risk} /></dd>
              </div>
            </dl>
            {item.reserved_qty > 0 && (
              <p className="mt-2 text-xs text-ink/50">
                {item.reserved_qty} {item.unit} of this listing is already reserved by other requests.
              </p>
            )}

            <div className="mt-5 border-t border-line pt-4">
              {myDemand.length === 0 ? (
                <p className="text-sm text-ink/70">
                  You have no open request for <strong>{item.food_item}</strong>. Post one under{" "}
                  <strong>My Needs</strong> first, then request supply against it.
                </p>
              ) : (
                <>
                  {myDemand.length > 1 && (
                    <label className="mb-3 block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Apply to which request?</span>
                      <select value={demandId} onChange={(e) => setDemandId(e.target.value)} className="input mt-1">
                        {myDemand.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.food_item} — {Math.max(d.quantity - d.quantity_received, 0)} kg still needed
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">How much do you need?</div>
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => step(-10)} className="btn-secondary px-3">−</button>
                    <div className="flex flex-1 items-center rounded border border-line bg-white px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        max={Math.round(maxQty)}
                        value={qty}
                        onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full text-center text-lg font-bold outline-none"
                      />
                      <span className="text-sm font-medium text-muted">{item.unit}</span>
                    </div>
                    <button onClick={() => step(10)} className="btn-secondary px-3">+</button>
                  </div>
                  <p className="mt-1.5 text-xs text-ink/50">
                    Up to {Math.round(maxQty)} {item.unit} — limited by what's available and what you still need.
                  </p>

                  {error && <div className="mt-3 text-sm font-medium text-crit-500">{error}</div>}

                  <button
                    disabled={busy || !qty || qty <= 0}
                    onClick={submit}
                    className="btn-primary mt-4 w-full"
                  >
                    {busy ? "Requesting…" : `Request ${qty || 0} ${item.unit}`}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
