// The transaction's five-stage journey. Vertical by default (detail
// view), horizontal when `compact` (inline in a list row).
export default function TransactionProgress({ stages, compact = false }) {
  if (!stages?.length) return null;

  const dot = (state) => {
    if (state === "done") return "bg-brand-500 border-brand-500";
    if (state === "active") return "bg-white border-amber-500 ring-2 ring-amber-200";
    return "bg-white border-line";
  };
  const text = (state) => {
    if (state === "done") return "text-brand-700 font-semibold";
    if (state === "active") return "text-amber-700 font-bold";
    return "text-ink/35";
  };

  if (compact) {
    return (
      <div className="flex items-center">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center">
            <div className={`h-2.5 w-2.5 rounded-full border-2 ${dot(s.state)}`} title={s.label} />
            {i < stages.length - 1 && (
              <div className={`h-px w-5 ${s.state === "done" ? "bg-brand-400" : "bg-line"}`} />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {stages.map((s, i) => (
        <li key={s.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${dot(s.state)}`} />
            {i < stages.length - 1 && (
              <div className={`w-0.5 flex-1 ${s.state === "done" ? "bg-brand-400" : "bg-line"}`} style={{ minHeight: 22 }} />
            )}
          </div>
          <div className={`pb-3 text-sm leading-none ${text(s.state)}`}>
            {s.label}
            {s.state === "active" && <span className="ml-2 text-[11px] font-medium text-amber-600">in progress</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
