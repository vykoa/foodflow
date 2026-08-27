import { useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import { fmtDateTime } from "../utils/format";

const SCENARIOS = [
  { key: "normal", label: "Normal" },
  { key: "supply_shock", label: "Supply Shock" },
  { key: "transport_delay", label: "Transport Delay" },
  { key: "demand_surge", label: "Demand Surge" },
  { key: "food_spoilage", label: "Food Spoilage" },
];

// Everything simulated/administrative lives behind this one discreet
// panel, opened from a small "Demo controls" button - it should never
// compete with the role-specific product experience for attention.
export default function DemoControls({ onClose }) {
  const { simState, bump } = useApp();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const showNotice = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  const runClock = async (hours, reset = false) => {
    setBusy(true);
    try {
      await api.moveClock(hours, reset);
      bump();
      showNotice(reset ? "Clock reset to now." : `Clock moved ${hours > 0 ? "+" : ""}${hours}h.`);
    } catch (e) {
      showNotice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runScenario = async (key) => {
    setBusy(true);
    try {
      const res = await api.runScenario(key);
      bump();
      showNotice(res.message || `Scenario applied: ${key}`);
    } catch (e) {
      showNotice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    if (!confirm("Reset the entire FOODFLOW demo to its seeded starting state?")) return;
    setBusy(true);
    try {
      await api.resetAll();
      bump();
      showNotice("Demo data reset to baseline.");
    } catch (e) {
      showNotice(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-line bg-paper px-6 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wide text-muted">Simulated clock</span>
          <span className="rounded bg-white px-2 py-1 font-mono text-[12px] font-medium">
            {simState ? fmtDateTime(simState.sim_now) : "…"}
          </span>
          <button disabled={busy} onClick={() => runClock(-6)} className="ctrl-btn">-6H</button>
          <button disabled={busy} onClick={() => runClock(0, true)} className="ctrl-btn">NOW</button>
          <button disabled={busy} onClick={() => runClock(6)} className="ctrl-btn">+6H</button>
          <button disabled={busy} onClick={() => runClock(12)} className="ctrl-btn">+12H</button>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wide text-muted">What if?</span>
          <select
            disabled={busy}
            value={simState?.active_scenario || "normal"}
            onChange={(e) => runScenario(e.target.value)}
            className="rounded border border-line bg-white px-2 py-1 text-xs font-medium"
          >
            {SCENARIOS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <button disabled={busy} onClick={doReset} className="font-semibold text-crit-500 hover:underline">
          Reset demo data
        </button>

        <button onClick={onClose} className="ml-auto text-ink/40 hover:text-ink">
          Close ✕
        </button>
      </div>
      {notice && <div className="mt-2 font-medium text-brand-700">{notice}</div>}
      <p className="mt-2 text-[11px] text-ink/40">
        These controls simulate time passing and network disruptions for demo purposes. They
        are not part of the normal participant experience.
      </p>
    </div>
  );
}
