import { useApp } from "../../context/AppContext";
import { getMyMoves } from "../../utils/myMoves";

export default function DistributorMoves() {
  const { currentUser, refreshKey } = useApp();
  const moves = currentUser ? getMyMoves(currentUser.id) : [];
  // refreshKey isn't read directly, but re-render on it so a move just
  // accepted from Home/Available Moves shows up immediately.
  void refreshKey;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">My Moves</h1>
        <p className="mt-1 text-sm text-ink/60">Deliveries you've accepted this session.</p>
      </div>

      <div className="panel overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Food</th><th>From</th><th>To</th><th>Quantity</th><th>Distance</th><th>Accepted</th></tr></thead>
          <tbody>
            {moves.length === 0 && (
              <tr><td colSpan={6} className="text-muted">No movements accepted yet — see Available Moves.</td></tr>
            )}
            {moves.map((m, i) => (
              <tr key={i}>
                <td className="font-medium">{m.food_item}</td>
                <td>{m.from}</td>
                <td>{m.to}</td>
                <td>{m.quantity} kg</td>
                <td>{m.distance_km} km</td>
                <td className="text-muted">{new Date(m.acceptedAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
