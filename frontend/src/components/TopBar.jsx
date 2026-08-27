import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useApp, ROLE_LABELS } from "../context/AppContext";
import { api } from "../services/api";
import { fmtDateTime } from "../utils/format";

const SCENARIOS = [
  { key: "normal", label: "Normal" },
  { key: "supply_shock", label: "Supply Shock" },
  { key: "transport_delay", label: "Transport Delay" },
  { key: "demand_surge", label: "Demand Surge" },
  { key: "food_spoilage", label: "Food Spoilage" },
];

export default function TopBar() {
  const { currentUser, setCurrentUser, simState, bump } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const showNotice = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4500);
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

  const switchRole = () => {
    setCurrentUser(null);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5">
        <div className="flex items-center gap-4">
          <Link to="/app/home" className="text-xs font-semibold text-brand-700 hover:underline">
            ← My dashboard
          </Link>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-muted">SIM CLOCK</span>
            <span className="rounded bg-paper px-2 py-1 font-mono text-[12px] font-medium text-ink">
              {simState ? fmtDateTime(simState.sim_now) : "…"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button disabled={busy} onClick={() => runClock(-6)} className="ctrl-btn">-6H</button>
            <button disabled={busy} onClick={() => runClock(0, true)} className="ctrl-btn">NOW</button>
            <button disabled={busy} onClick={() => runClock(6)} className="ctrl-btn">+6H</button>
            <button disabled={busy} onClick={() => runClock(12)} className="ctrl-btn">+12H</button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs font-semibold text-muted">WHAT IF?</span>
            <select
              disabled={busy}
              value={simState?.active_scenario || "normal"}
              onChange={(e) => runScenario(e.target.value)}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs font-medium"
            >
              {SCENARIOS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <button
            disabled={busy}
            onClick={doReset}
            className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-paper"
          >
            Reset Demo
          </button>
          {currentUser && (
            <button
              onClick={switchRole}
              className="flex items-center gap-2 rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs font-medium hover:bg-line/40"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              {currentUser.name}
              <span className="text-muted">· {ROLE_LABELS[currentUser.role] || currentUser.role}</span>
            </button>
          )}
        </div>
      </div>
      {notice && (
        <div className="border-t border-line bg-brand-50 px-6 py-1.5 text-xs font-medium text-brand-700">
          {notice}
        </div>
      )}
    </header>
  );
}
