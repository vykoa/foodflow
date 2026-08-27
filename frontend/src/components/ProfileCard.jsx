import { useEffect, useState } from "react";
import { api } from "../services/api";
import { ROLE_LABELS } from "../context/AppContext";

const TYPE_LABEL = {
  farmer: "Farm", producer: "Local producer", supplier: "Supplier",
  distributor: "Distribution partner", school: "School", kitchen: "Community kitchen",
  market: "Market", household: "Household", business: "Small business",
};

// Lightweight public profile - who this participant is and what they
// bring to the network. No auth, no KYC; just enough that people in the
// network read as real organisations rather than anonymous seed rows.
export default function ProfileCard({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getProfile(userId).then(setProfile).catch((e) => setError(e.message));
  }, [userId]);

  const body = () => {
    if (error) return <p className="text-sm text-crit-500">{error}</p>;
    if (!profile) return <p className="text-sm text-muted">Loading profile…</p>;

    const isDistributor = profile.role === "distributor";
    return (
      <>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">{profile.name}</h2>
            <p className="text-sm text-ink/60">
              {TYPE_LABEL[profile.role] || ROLE_LABELS[profile.role] || profile.role} · {profile.location_name}
            </p>
          </div>
          {onClose && <button onClick={onClose} className="text-muted hover:text-ink">✕</button>}
        </div>

        {isDistributor ? (
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Vehicle</dt>
              <dd className="mt-0.5 text-sm font-bold">{profile.vehicle_type || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Capacity</dt>
              <dd className="mt-0.5 text-sm font-bold">{profile.capacity_kg ? `${profile.capacity_kg} kg` : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Service area</dt>
              <dd className="mt-0.5 text-sm font-bold">{profile.service_area_km ? `${profile.service_area_km} km` : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Deliveries</dt>
              <dd className="mt-0.5 text-sm font-bold">
                {profile.active_moves} active · {profile.completed_moves} completed
              </dd>
            </div>
          </dl>
        ) : (
          <div className="mt-4 space-y-3">
            {profile.foods?.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Currently offering</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {profile.foods.map((f) => (
                    <span key={f} className="tag bg-brand-50 text-brand-700">{f}</span>
                  ))}
                </div>
              </div>
            )}
            {profile.current_needs?.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Currently needs</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {profile.current_needs.map((f) => (
                    <span key={f} className="tag bg-amber-50 text-amber-700">{f}</span>
                  ))}
                </div>
              </div>
            )}
            {!profile.foods?.length && !profile.current_needs?.length && (
              <p className="text-sm text-muted">No active listings or requests right now.</p>
            )}
          </div>
        )}
      </>
    );
  };

  if (!onClose) return <div className="panel p-5">{body()}</div>;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-16" onClick={onClose}>
      <div className="panel w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>{body()}</div>
    </div>
  );
}
