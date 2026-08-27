// Thin fetch wrapper around the FOODFLOW FastAPI backend.
// Every function here maps 1:1 to a backend endpoint - no client-side
// business logic lives in this file, it only talks to the one source
// of truth (the database, via the API).
const BASE = "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch (_) {
      /* no json body */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // reference data
  getLocations: () => request("/api/locations"),
  getUsers: (role) => request(`/api/users${role ? `?role=${encodeURIComponent(role)}` : ""}`),

  // inventory
  getInventory: (ownerId) => request(`/api/inventory${ownerId ? `?owner_id=${ownerId}` : ""}`),
  createInventory: (body) => request("/api/inventory", { method: "POST", body: JSON.stringify(body) }),
  updateInventory: (id, body) => request(`/api/inventory/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteInventory: (id) => request(`/api/inventory/${id}`, { method: "DELETE" }),

  // demand
  getDemand: (requesterId) => request(`/api/demand${requesterId ? `?requester_id=${requesterId}` : ""}`),
  createDemand: (body) => request("/api/demand", { method: "POST", body: JSON.stringify(body) }),
  updateDemand: (id, body) => request(`/api/demand/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteDemand: (id) => request(`/api/demand/${id}`, { method: "DELETE" }),

  // matching
  getMatches: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/matches${qs ? `?${qs}` : ""}`);
  },
  acceptMatch: (id, quantity) =>
    request(`/api/matches/${id}/accept`, { method: "POST", body: JSON.stringify(quantity ? { quantity } : {}) }),
  rejectMatch: (id) => request(`/api/matches/${id}/reject`, { method: "POST" }),

  // waste / forecast / impact / signals
  getWasteRisk: () => request("/api/waste-risk"),
  getForecast: (entityId, foodItem) =>
    request(`/api/forecast/${entityId}${foodItem ? `?food_item=${encodeURIComponent(foodItem)}` : ""}`),
  getImpact: () => request("/api/impact"),
  getSignals: () => request("/api/signals"),
  getEvents: (limit = 30) => request(`/api/events?limit=${limit}`),

  // simulation
  getState: () => request("/api/state"),
  moveClock: (hours, reset = false) =>
    request("/api/simulation/clock", { method: "POST", body: JSON.stringify({ hours, reset }) }),
  runScenario: (scenario) => request(`/api/simulation/${scenario}`, { method: "POST" }),

  resetAll: () => request("/api/reset", { method: "POST" }),
};
