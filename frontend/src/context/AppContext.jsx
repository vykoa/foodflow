import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

const AppContext = createContext(null);

// Legacy grouping - still used by the original (secondary) full pages
// under "Explore Network" for their CRUD forms.
export const SUPPLY_ROLES = ["farmer", "producer", "supplier", "distributor"];
export const DEMAND_ROLES = ["school", "kitchen", "market", "household", "business"];

export const ROLE_LABELS = {
  farmer: "Farmer",
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

// ---------------------------------------------------------------------
// The three "worlds" a participant belongs to. This is the primary
// mental model of the new entry experience: everything about nav,
// home dashboard, and language is driven off which world a role sits in.
// ---------------------------------------------------------------------
export const WORLDS = {
  PRODUCER: "producer",
  DEMANDER: "demander",
  DISTRIBUTOR: "distributor",
};

export const WORLD_ROLES = {
  [WORLDS.PRODUCER]: ["farmer", "producer", "supplier"],
  [WORLDS.DEMANDER]: ["school", "kitchen", "market", "household", "business"],
  [WORLDS.DISTRIBUTOR]: ["distributor"],
};

export const WORLD_META = {
  [WORLDS.PRODUCER]: {
    title: "I Have Food",
    subtitle: "Farmer / Producer / Supplier",
    question: "I have food. Who needs it, and how can I get it there before it loses value?",
  },
  [WORLDS.DEMANDER]: {
    title: "I Need Food",
    subtitle: "School / Kitchen / Market / Household / Small Business",
    question: "I need food. Where can I get it nearby and reliably?",
  },
  [WORLDS.DISTRIBUTOR]: {
    title: "I Move Food",
    subtitle: "Distributor / Transport Partner",
    question: "What food needs to move, where does it need to go, and which movements can I accept?",
  },
};

export function getWorld(role) {
  for (const [world, roles] of Object.entries(WORLD_ROLES)) {
    if (roles.includes(role)) return world;
  }
  return null;
}

// Small, role-specific navigation - deliberately 4 items, not the full
// 9-tab admin sidebar. Each `to` is a real route; several reuse existing
// pages under new, human-scale labels.
export const WORLD_NAV = {
  [WORLDS.PRODUCER]: [
    { label: "Home", to: "/app/home" },
    { label: "My Food", to: "/app/my-food" },
    { label: "Find Demand", to: "/app/find-demand" },
    { label: "Distribution", to: "/app/distribution" },
  ],
  [WORLDS.DEMANDER]: [
    { label: "Home", to: "/app/home" },
    { label: "My Needs", to: "/app/my-needs" },
    { label: "Find Food", to: "/app/find-food" },
    { label: "My Inventory", to: "/app/my-inventory" },
  ],
  [WORLDS.DISTRIBUTOR]: [
    { label: "Home", to: "/app/home" },
    { label: "Available Moves", to: "/app/available-moves" },
    { label: "My Moves", to: "/app/my-moves" },
    { label: "Network", to: "/app/network" },
  ],
};

// The verb shown on a match/allocation action button depends on who is
// looking at it - a producer "accepts an allocation", a demander
// "requests supply", a distributor "accepts a delivery".
export const ACTION_LABELS = {
  [WORLDS.PRODUCER]: { accept: "Accept allocation", reject: "Not now" },
  [WORLDS.DEMANDER]: { accept: "Request supply", reject: "Not now" },
  [WORLDS.DISTRIBUTOR]: { accept: "Accept delivery", reject: "Skip" },
};

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
