export default function StatTile({ label, value, sub, tone = "default" }) {
  const toneCls = {
    default: "text-ink",
    brand: "text-brand-600",
    amber: "text-amber-600",
    crit: "text-crit-500",
  }[tone];

  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
