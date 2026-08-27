import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";

// Walks one real food order end-to-end: producer -> buyer -> distributor
// -> fulfilled. Every step drives the real API against the real database.
const STEPS = [
  {
    title: "1. A producer has food",
    body: "Green Valley Farm is holding 500 kg of tomatoes with 48 hours of shelf life left.",
    to: "/app/home",
    as: "farmer",
  },
  {
    title: "2. Who needs it?",
    body: "FoodFlow scans nearby demand for every item this farm holds, and ranks the buyers.",
    to: "/app/find-demand",
  },
  {
    title: "3. A buyer needs tomatoes",
    body: "Lakeside Elementary needs 150 kg, tomorrow, at HIGH priority. Switching to their view.",
    to: "/app/home",
    as: "school",
  },
  {
    title: "4. Find it nearby",
    body: "The school browses local food. Each listing shows distance, freshness and waste risk.",
    to: "/app/find-food",
  },
  {
    title: "5. Request only what's needed",
    body: "The school requests 100 kg of the 500 kg listing. The rest stays available to others.",
    to: "/app/find-food",
    action: async () => {
      const inv = await api.getInventory();
      const listing = inv.find(
        (i) => i.food_item === "Tomatoes" && i.owner_name === "Green Valley Farm" && i.available_qty >= 100
      );
      const demands = await api.getDemand();
      const need = demands.find(
        (d) => d.food_item === "Tomatoes" && d.requester_name === "Lakeside Elementary" && d.status === "open"
      );
      if (listing && need) {
        await api.requestSupply({ inventory_id: listing.id, demand_id: need.id, quantity: 100 });
      }
    },
  },
  {
    title: "6. 100 kg is now reserved",
    body: "The farm's listing shows 400 kg available and 100 kg reserved. Nothing has physically moved yet.",
    to: "/app/home",
    as: "farmer",
  },
  {
    title: "7. A delivery opportunity appears",
    body: "Distributors see the movement waiting to be picked up — filtered to what their vehicle can carry.",
    to: "/app/home",
    as: "distributor",
  },
  {
    title: "8. The distributor accepts",
    body: "Accepting assigns the move and advances the transaction to 'Distributor assigned'.",
    to: "/app/available-moves",
  },
  {
    title: "9. Picked up, then delivered",
    body: "Marking delivered is the only moment stock actually leaves the farm and reaches the school.",
    to: "/app/my-moves",
  },
  {
    title: "10. Inventory and demand update",
    body: "The farm drops to 400 kg; the school's outstanding need falls by 100 kg. One shared state.",
    to: "/app/inventory",
  },
  {
    title: "11. Impact rises",
    body: "Delivered food, rescued food and CO₂ avoided all move — derived only from completed deliveries.",
    to: "/app/impact",
  },
  {
    title: "12. Waste drives priority",
    body: "Food near expiry is flagged as rescue priority, pushing it up the recommendation order.",
    to: "/app/waste-watch",
  },
];

export default function DemoGuide() {
  const { setDemoMode, bump, setCurrentUser } = useApp();
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
        // Some steps change whose eyes you're seeing the network through.
        if (next.as) {
          const users = await api.getUsers(next.as);
          if (users.length) setCurrentUser(users[0]);
        }
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
    <div className="panel fixed bottom-5 right-5 z-40 w-80 p-4 shadow-lg">
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
