import { RISK_STYLES } from "../utils/format";

export default function RiskBadge({ level, size = "sm" }) {
  const style = RISK_STYLES[level] || RISK_STYLES.LOW;
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-current/10 font-semibold tracking-wide uppercase ${style.bg} ${style.text} ${pad}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {level}
    </span>
  );
}
