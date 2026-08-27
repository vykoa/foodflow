import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";

const ROLE_CARDS = [
  { role: "farmer", title: "Farmer / Producer", desc: "List surplus, track shelf life, get rescued.", icon: "🌾" },
  { role: "supplier", title: "Supplier / Distributor", desc: "Move volume, see dispatch and demand.", icon: "🚚" },
  { role: "school", title: "School", desc: "Cover meal programs, request supply.", icon: "🏫" },
  { role: "kitchen", title: "Community Kitchen", desc: "Absorb rescued food fast.", icon: "🍲" },
  { role: "market", title: "Market", desc: "Stock local produce, resell surplus.", icon: "🛒" },
  { role: "household", title: "Household", desc: "Small quantities, direct requests.", icon: "🏠" },
  { role: "business", title: "Small Business", desc: "Cafés, caterers, local shops.", icon: "🏪" },
];

export default function Landing() {
  const navigate = useNavigate();
  const { setCurrentUser, bump, setDemoMode } = useApp();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const chooseRole = async (role) => {
    setLoading(role);
    setError(null);
    try {
      const users = await api.getUsers(role);
      if (!users.length) throw new Error(`No seeded user found for role "${role}"`);
      setCurrentUser(users[0]);
      navigate("/app/overview");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  const startDemo = async () => {
    setLoading("demo");
    setError(null);
    try {
      const users = await api.getUsers("farmer");
      setCurrentUser(users[0]);
      bump();
      setDemoMode(true);
      navigate("/app/overview");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-6 py-14 text-ink">
      <div className="w-full max-w-4xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
            F
          </div>
          <div className="text-2xl font-extrabold tracking-tight">FOODFLOW</div>
        </div>

        <h1 className="mt-8 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
          Move food before<br />it becomes waste.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink/70">
          Connect local food supply with local demand, prevent waste, and make better distribution
          decisions — with a deterministic, explainable matching engine that shows exactly why food
          should move where it's headed.
        </p>

        <button onClick={startDemo} disabled={loading === "demo"} className="btn-primary mt-6 px-5 py-3 text-sm">
          {loading === "demo" ? "Loading demo…" : "▶ Start Demo"}
        </button>

        <h2 className="mt-12 text-xs font-bold uppercase tracking-widest text-muted">Who are you?</h2>
        {error && <p className="mt-2 text-sm font-medium text-crit-500">{error}</p>}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {ROLE_CARDS.map((r) => (
            <button
              key={r.role}
              onClick={() => chooseRole(r.role)}
              disabled={loading === r.role}
              className="card flex flex-col items-start p-4 text-left transition hover:border-brand-300 hover:shadow-md disabled:opacity-60"
            >
              <span className="text-2xl">{r.icon}</span>
              <span className="mt-2 text-sm font-bold text-ink">
                {loading === r.role ? "Loading…" : r.title}
              </span>
              <span className="mt-1 text-xs text-muted">{r.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
