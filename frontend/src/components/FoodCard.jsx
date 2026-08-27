import RiskBadge from "./RiskBadge";

const TYPE_LABEL = {
  producer: "Producer", farmer: "Producer", supplier: "Supplier", distributor: "Distributor",
  school: "School", kitchen: "Community Kitchen", market: "Market", household: "Household", business: "Business",
};

export default function FoodCard({ item, distanceKm, onView }) {
  const rescueMode = item.waste_risk === "CRITICAL";
  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-start justify-between">
        <h4 className="text-lg font-bold text-ink">{item.food_item}</h4>
        <RiskBadge level={item.waste_risk} />
      </div>
      <div className="mt-1 text-2xl font-extrabold text-ink">
        {item.quantity} <span className="text-sm font-medium text-muted">{item.unit} available</span>
      </div>

      <div className="mt-3 space-y-1 text-sm text-ink/80">
        <div className="font-medium">{item.owner_name}</div>
        <div className="text-muted">
          {TYPE_LABEL[item.owner_role] || item.owner_role}
          {distanceKm != null && <> · {distanceKm.toFixed(1)} km away</>}
        </div>
        <div className="text-muted">
          {item.waste_risk === "LOW" || item.waste_risk === "MEDIUM"
            ? "Available now"
            : `Freshness: ${item.time_remaining_label} remaining`}
        </div>
      </div>

      <button onClick={() => onView?.(item)} className={`mt-3 ${rescueMode ? "btn-danger-outline" : "btn-secondary"}`}>
        {rescueMode ? "Rescue / Request" : "View"}
      </button>
    </div>
  );
}
