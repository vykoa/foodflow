import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/app/overview", label: "Overview", icon: "◈" },
  { to: "/app/local-food", label: "Local Food", icon: "⬢" },
  { to: "/app/supply", label: "Supply", icon: "↑" },
  { to: "/app/demand", label: "Demand", icon: "↓" },
  { to: "/app/inventory", label: "Inventory", icon: "▤" },
  { to: "/app/matches", label: "Smart Matches", icon: "⇄" },
  { to: "/app/waste-watch", label: "Waste Watch", icon: "◷" },
  { to: "/app/map", label: "Map", icon: "◎" },
  { to: "/app/impact", label: "Impact", icon: "✦" },
];

export default function Sidebar() {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
          F
        </div>
        <div>
          <div className="text-sm font-bold leading-none">FOODFLOW</div>
          <div className="text-[10px] text-muted">Millbrook network</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink/70 hover:bg-paper hover:text-ink"
              }`
            }
          >
            <span className="w-4 text-center text-[13px] opacity-70">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line px-4 py-3 text-[11px] text-muted">
        Move food before it becomes waste.
      </div>
    </aside>
  );
}
