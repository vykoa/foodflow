import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import { fmtTimeOnly } from "../utils/format";

const TYPE_DOT = {
  info: "bg-muted",
  supply: "bg-brand-500",
  demand: "bg-amber-500",
  match: "bg-brand-400",
  allocation: "bg-brand-600",
  rescue: "bg-crit-500",
  scenario: "bg-amber-600",
};

export default function ActivityFeed({ limit = 12 }) {
  const { refreshKey } = useApp();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api.getEvents(limit).then(setEvents).catch(console.error);
  }, [refreshKey, limit]);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink">Activity</h3>
        <span className="text-[11px] text-muted">live feed</span>
      </div>
      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
        {events.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
        {events.map((e) => (
          <div key={e.id} className="flex gap-2.5 text-sm">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[e.type] || "bg-muted"}`} />
            <div>
              <div className="text-[11px] font-mono text-muted">{fmtTimeOnly(e.timestamp)}</div>
              <div className="leading-snug text-ink">{e.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
