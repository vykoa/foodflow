import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import AppLayout from "./components/AppLayout";
import Landing from "./pages/Landing";
import Overview from "./pages/Overview";
import LocalFood from "./pages/LocalFood";
import Supply from "./pages/Supply";
import Demand from "./pages/Demand";
import Inventory from "./pages/Inventory";
import SmartMatches from "./pages/SmartMatches";
import WasteWatch from "./pages/WasteWatch";
import MapView from "./pages/MapView";
import Impact from "./pages/Impact";

function RequireUser({ children }) {
  const { currentUser } = useApp();
  if (!currentUser) return <Navigate to="/" replace />;
  return children;
}

function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/app"
          element={
            <RequireUser>
              <AppLayout />
            </RequireUser>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
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
