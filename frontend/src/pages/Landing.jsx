import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useApp, WORLDS, WORLD_META, ROLE_LABELS } from "../context/AppContext";

const WORLD_CARDS = [
  {
    world: WORLDS.PRODUCER,
    label: "I HAVE FOOD",
    sub: "Farmer / Producer / Supplier",
    body: "List what's available and get it to the people who need it before it loses value.",
  },
  {
    world: WORLDS.DEMANDER,
    label: "I NEED FOOD",
    sub: "School / Kitchen / Market / Household / Small Business",
    body: "See what's available nearby and request supply reliably.",
  },
  {
    world: WORLDS.DISTRIBUTOR,
    label: "I MOVE FOOD",
    sub: "Distributor / Transport Partner",
    body: "See what needs to move, where it's headed, and accept the deliveries that fit.",
  },
];

const SUB_ROLES = {
  [WORLDS.PRODUCER]: ["farmer", "producer", "supplier"],
  [WORLDS.DEMANDER]: ["school", "kitchen", "market", "household", "business"],
  [WORLDS.DISTRIBUTOR]: ["distributor"],
};

export default function Landing() {
  const navigate = useNavigate();
  const { setCurrentUser, bump, setDemoMode } = useApp();
  const [world, setWorld] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const chooseRole = async (role) => {
    setLoading(role);
    setError(null);
    try {
      const users = await api.getUsers(role);
      if (!users.length) throw new Error(`No seeded user found for role "${role}"`);
      setCurrentUser(users[0]);
      navigate("/app/home");
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
      navigate("/app/home");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  const exploreNetwork = async () => {
    setLoading("explore");
    setError(null);
    try {
      const users = await api.getUsers("farmer");
      setCurrentUser(users[0]);
      navigate("/app/overview");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-6 py-16 text-ink">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-brand-600 text-base font-bold text-white">
            F
          </div>
          <div className="font-display text-xl font-bold tracking-tight">FOODFLOW</div>
        </div>

        <h1 className="font-display mt-10 text-4xl font-bold leading-[1.1] tracking-tight md:text-[2.75rem]">
          Move food before it becomes waste.
        </h1>

        {!world ? (
          <>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink/70">
              FoodFlow connects local food supply with local food demand, and helps the
              network decide what should move where — before it spoils.
            </p>

            <h2 className="mt-12 text-sm font-semibold text-ink/60">
              Choose how you participate in the local food network.
            </h2>
            {error && <p className="mt-2 text-sm font-medium text-crit-500">{error}</p>}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {WORLD_CARDS.map((c) => (
                <button
                  key={c.world}
                  onClick={() => setWorld(c.world)}
                  className="world-card"
                >
                  <span className="text-lg font-bold tracking-tight">{c.label}</span>
                  <span className="mt-1 block text-xs font-medium text-ink/50">{c.sub}</span>
                  <span className="mt-3 block text-[13px] leading-snug text-ink/70">{c.body}</span>
                </button>
              ))}
            </div>

            <div className="mt-10 flex items-center gap-5 border-t border-line pt-5 text-sm">
              <button onClick={startDemo} disabled={loading === "demo"} className="font-semibold text-brand-700 hover:underline">
                {loading === "demo" ? "Loading…" : "▶ Start guided demo"}
              </button>
              <button onClick={exploreNetwork} disabled={loading === "explore"} className="text-ink/50 hover:text-ink hover:underline">
                {loading === "explore" ? "Loading…" : "Explore full network →"}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setWorld(null)}
              className="mt-8 text-sm font-medium text-ink/50 hover:text-ink"
            >
              ← back
            </button>
            <h2 className="mt-3 text-sm font-semibold text-ink/60">
              {WORLD_META[world].title} — which best describes you?
            </h2>
            {error && <p className="mt-2 text-sm font-medium text-crit-500">{error}</p>}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {SUB_ROLES[world].map((role) => (
                <button
                  key={role}
                  onClick={() => chooseRole(role)}
                  disabled={loading === role}
                  className="role-pill"
                >
                  {loading === role ? "Loading…" : ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
