import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import DemoGuide from "./DemoGuide";
import { useApp } from "../context/AppContext";

export default function AppLayout() {
  const { demoMode } = useApp();
  return (
    <div className="flex h-screen w-full overflow-hidden bg-paper text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
      {demoMode && <DemoGuide />}
    </div>
  );
}
