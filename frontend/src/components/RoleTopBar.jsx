import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useApp, getWorld, WORLD_NAV, ROLE_LABELS } from "../context/AppContext";
import DemoControls from "./DemoControls";
import ProfileCard from "./ProfileCard";

export default function RoleTopBar() {
  const { currentUser, setCurrentUser } = useApp();
  const navigate = useNavigate();
  const [demoOpen, setDemoOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const world = currentUser ? getWorld(currentUser.role) : null;
  const nav = world ? WORLD_NAV[world] : [];

  const switchRole = () => {
    setCurrentUser(null);
    navigate("/");
  };

  return (
    <header className="border-b border-line bg-surface">
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-brand-600 text-xs font-bold text-white">
              F
            </div>
            <span className="font-display text-[15px] font-bold tracking-tight">FOODFLOW</span>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `rounded px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    isActive ? "bg-brand-50 text-brand-700" : "text-ink/60 hover:text-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/app/overview" className="hidden text-xs text-ink/40 hover:text-ink/70 hover:underline lg:inline">
            Explore full network →
          </Link>
          <button
            onClick={() => setDemoOpen((v) => !v)}
            className="rounded border border-line px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/50 hover:text-ink"
          >
            Demo controls
          </button>
          {currentUser && (
            <div className="flex items-center rounded border border-line bg-paper">
              <button
                onClick={() => setProfileOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium hover:bg-line/40"
                title="View my profile"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                {currentUser.name}
                <span className="text-muted">· {ROLE_LABELS[currentUser.role] || currentUser.role}</span>
              </button>
              <button
                onClick={switchRole}
                className="border-l border-line px-2 py-1.5 text-xs text-muted hover:bg-line/40 hover:text-ink"
                title="Switch role"
              >
                ⇄
              </button>
            </div>
          )}
        </div>
      </div>

      {/* mobile nav row */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-line px-3 py-1.5 md:hidden">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              `shrink-0 rounded px-3 py-1.5 text-[13px] font-semibold ${
                isActive ? "bg-brand-50 text-brand-700" : "text-ink/60"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {demoOpen && <DemoControls onClose={() => setDemoOpen(false)} />}
      {profileOpen && currentUser && (
        <ProfileCard userId={currentUser.id} onClose={() => setProfileOpen(false)} />
      )}
    </header>
  );
}
