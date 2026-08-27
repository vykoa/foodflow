import { PRIORITY_STYLES } from "../utils/format";

export default function PriorityPill({ priority }) {
  const cls = PRIORITY_STYLES[priority] || PRIORITY_STYLES.NORMAL;
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {priority}
    </span>
  );
}
