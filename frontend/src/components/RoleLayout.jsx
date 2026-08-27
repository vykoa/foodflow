import { Outlet } from "react-router-dom";
import RoleTopBar from "./RoleTopBar";

// The primary experience: a small role-specific top nav (no 9-tab
// sidebar) plus whatever page the current world's nav points to.
// DemoGuide is mounted once, above this layout and AppLayout (see
// App.jsx), so its step state survives switching between them.
export default function RoleLayout() {
  return (
    <div className="min-h-screen w-full bg-paper text-ink">
      <RoleTopBar />
      <main className="mx-auto max-w-[1200px] px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
