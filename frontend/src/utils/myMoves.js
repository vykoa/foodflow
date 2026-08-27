// A distributor "accepting a delivery" is, under the hood, the same
// accept-match action a producer or demander performs (the backend has
// no separate transporter/assignment concept, by design - see
// iteration notes). To let a distributor see "My Moves" without any
// schema change, we keep a lightweight per-user, session-local record
// of which moves they personally accepted.
const KEY = "foodflow_my_moves";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function getMyMoves(userId) {
  const all = readAll();
  return all[userId] || [];
}

export function recordMove(userId, move) {
  const all = readAll();
  const list = all[userId] || [];
  all[userId] = [{ ...move, acceptedAt: new Date().toISOString() }, ...list].slice(0, 20);
  localStorage.setItem(KEY, JSON.stringify(all));
}
