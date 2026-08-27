export const RISK_STYLES = {
  CRITICAL: { bg: "bg-crit-50", text: "text-crit-600", dot: "bg-crit-500", bar: "#ab2626" },
  HIGH: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", bar: "#c1841c" },
  MEDIUM: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-300", bar: "#dd9f2b" },
  LOW: { bg: "bg-brand-50", text: "text-brand-700", dot: "bg-brand-500", bar: "#2f7d3f" },
  EXPIRED: { bg: "bg-crit-50", text: "text-crit-600", dot: "bg-crit-600", bar: "#821c1c" },
};

export const PRIORITY_STYLES = {
  CRITICAL: "bg-crit-50 text-crit-600 border-crit-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  NORMAL: "bg-surface text-muted border-line",
  LOW: "bg-brand-50 text-brand-700 border-brand-200",
};

export function fmtKg(qty, unit = "kg") {
  if (qty === null || qty === undefined) return "-";
  return `${Math.round(qty * 10) / 10} ${unit}`;
}

export function fmtKm(km) {
  if (km === null || km === undefined) return "-";
  return `${km.toFixed(1)} km`;
}

export function fmtDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function fmtTimeOnly(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function hoursUntil(iso, simNowIso) {
  const target = new Date(iso).getTime();
  const now = simNowIso ? new Date(simNowIso).getTime() : Date.now();
  return (target - now) / 3600000;
}
