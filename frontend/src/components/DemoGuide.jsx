import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";

const STEPS = [
  {
    title: "1. Local supply",
    body: "Producers and suppliers across Millbrook list what's available right now.",
    to: "/app/local-food",
  },
  {
    title: "2. Local demand",
    body: "Schools, kitchens, markets and households post what they need.",
    to: "/app/demand",
  },
  {
    title: "3. Imbalance",
    body: "FOODFLOW SIGNALS surfaces surplus that has no buyer yet, and shortages nobody has covered.",
    to: "/app/overview",
  },
  {
    title: "4. Expiry risk",
    body: "WASTE WATCH ranks inventory by how soon it will spoil, with a live rescue clock.",
    to: "/app/waste-watch",
  },
  {
    title: "5. Smart matches",
    body: "The deterministic matching engine ranks every viable supply → demand pair, 0-100%.",
    to: "/app/matches",
  },
  {
    title: "6. Accept an allocation",
    body: "Accepting the top-ranked match moves real inventory and demand in the database.",
    to: "/app/matches",
    action: async () => {
      const matches = await api.getMatches({ top_n: 1 });
      if (matches[0]) await api.acceptMatch(matches[0].id);
    },
  },
  {
    title: "7. Inventory & demand update",
    body: "The supplied quantity is gone from inventory; the buyer's shortage just shrank.",
    to: "/app/inventory",
  },
  {
    title: "8. Waste risk falls",
    body: "That item drops off (or down) the Waste Watch list immediately.",
    to: "/app/waste-watch",
  },
  {
    title: "9. Impact rises",
    body: "Food redistributed, food rescued and CO2 avoided all update from real allocation events.",
    to: "/app/impact",
  },
  {
    title: "10. Supply shock",
    body: "A major supplier just went offline. Watch what happens to affected demand.",
    to: "/app/matches",
    action: async () => api.runScenario("supply_shock"),
  },
  {
    title: "11. Recalculate",
    body: "The matching engine re-ranks instantly, using only suppliers still online.",
    to: "/app/matches",
  },
  {
    title: "12. Alternative allocation",
    body: "A different supplier now ranks highest for the same demand. Explainable, every time.",
    to: "/app/matches",
  },
];

export default function DemoGuide() {
  const { setDemoMode, bump } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const current = STEPS[step];

  const close = () => setDemoMode(false);

  const advance = async () => {
    setBusy(true);
    try {
      if (current.action) await current.action();
      bump();
      if (step + 1 < STEPS.length) {
        const next = STEPS[step + 1];
        navigate(next.to);
        setStep(step + 1);
      } else {
        close();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 w-80 card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-brand-600">
          Demo · step {step + 1}/{STEPS.length}
        </span>
        <button onClick={close} className="text-muted hover:text-ink">✕</button>
      </div>
      <div className="mt-1.5 text-sm font-bold text-ink">{current.title}</div>
      <p className="mt-1 text-xs leading-relaxed text-ink/75">{current.body}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={advance} disabled={busy} className="btn-primary flex-1">
          {busy ? "Working…" : step + 1 === STEPS.length ? "Finish" : "Next →"}
        </button>
        <button onClick={close} className="btn-secondary">Skip</button>
      </div>
    </div>
  );
}
