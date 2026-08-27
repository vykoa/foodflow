import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

const AppContext = createContext(null);

export const SUPPLY_ROLES = ["farmer", "producer", "supplier", "distributor"];
export const DEMAND_ROLES = ["school", "kitchen", "market", "household", "business"];

export const ROLE_LABELS = {
  farmer: "Farmer / Producer",
  producer: "Local Producer",
  supplier: "Supplier",
  distributor: "Distributor",
  school: "School",
  kitchen: "Community Kitchen",
  market: "Local Market",
  household: "Household",
  business: "Small Business",
};

export function isSupplyRole(role) {
  return SUPPLY_ROLES.includes(role);
}

export function AppProvider({ children }) {
  const [currentUser, setCurrentUserState] = useState(() => {
    const raw = localStorage.getItem("foodflow_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [users, setUsers] = useState([]);
  const [simState, setSimState] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [demoMode, setDemoMode] = useState(false);

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  const setCurrentUser = useCallback((user) => {
    setCurrentUserState(user);
    if (user) localStorage.setItem("foodflow_user", JSON.stringify(user));
    else localStorage.removeItem("foodflow_user");
  }, []);

  const refreshSimState = useCallback(async () => {
    try {
      const s = await api.getState();
      setSimState(s);
    } catch (e) {
      console.error("Failed to load simulation state", e);
    }
  }, []);

  useEffect(() => {
    api.getUsers().then(setUsers).catch((e) => console.error(e));
    refreshSimState();
  }, [refreshKey, refreshSimState]);

  return (
    <AppContext.Provider
      value={{
        currentUser, setCurrentUser, users, simState, refreshSimState, refreshKey, bump,
        demoMode, setDemoMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
