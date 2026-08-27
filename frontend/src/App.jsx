import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import AppLayout from "./components/AppLayout";
import RoleLayout from "./components/RoleLayout";
import DemoGuide from "./components/DemoGuide";
import Landing from "./pages/Landing";

// Legacy full-nav pages, reached via "Explore full network".
import Overview from "./pages/Overview";
import LocalFood from "./pages/LocalFood";
import Supply from "./pages/Supply";
import Demand from "./pages/Demand";
import Inventory from "./pages/Inventory";
import SmartMatches from "./pages/SmartMatches";
import WasteWatch from "./pages/WasteWatch";
import MapView from "./pages/MapView";
import Impact from "./pages/Impact";

// New role-specific home experience.
import Home from "./pages/homes/Home";
import ProducerDistribution from "./pages/homes/ProducerDistribution";
import DemanderInventory from "./pages/homes/DemanderInventory";
import DistributorMoves from "./pages/homes/DistributorMoves";
import AvailableMoves from "./pages/homes/AvailableMoves";
import FindDemand from "./pages/homes/FindDemand";

// Mounted once for the whole "/app" tree so DemoGuide's step state
// survives navigation between the role layout and the legacy full-nav
// layout (the guided demo crosses that boundary mid-flow).
function RequireUser() {
  const { currentUser, demoMode } = useApp();
  if (!currentUser) return <Navigate to="/" replace />;
  return (
    <>
      <Outlet />
      {demoMode && <DemoGuide />}
    </>
  );
}

function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />

        <Route path="/app" element={<RequireUser />}>
          {/* Primary experience: small role-specific nav, one home per world. */}
          <Route element={<RoleLayout />}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<Home />} />

            {/* Producer */}
            <Route path="my-food" element={<Supply />} />
            <Route path="find-demand" element={<FindDemand />} />
            <Route path="distribution" element={<ProducerDistribution />} />

            {/* Demander */}
            <Route path="my-needs" element={<Demand />} />
            <Route path="find-food" element={<LocalFood />} />
            <Route path="my-inventory" element={<DemanderInventory />} />

            {/* Distributor */}
            <Route path="available-moves" element={<AvailableMoves />} />
            <Route path="my-moves" element={<DistributorMoves />} />
            <Route path="network" element={<MapView />} />
          </Route>

          {/* Secondary experience: the original full 9-tab dashboard,
              reachable via "Explore full network" / Start Demo. */}
          <Route element={<AppLayout />}>
            <Route path="overview" element={<Overview />} />
            <Route path="local-food" element={<LocalFood />} />
            <Route path="supply" element={<Supply />} />
            <Route path="demand" element={<Demand />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="matches" element={<SmartMatches />} />
            <Route path="waste-watch" element={<WasteWatch />} />
            <Route path="map" element={<MapView />} />
            <Route path="impact" element={<Impact />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
