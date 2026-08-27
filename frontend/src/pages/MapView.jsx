import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";

const TYPE_COLOR = {
  producer: "#2f7d3f", farmer: "#2f7d3f", supplier: "#256633", distributor: "#194422",
  school: "#c1841c", kitchen: "#dd9f2b", market: "#ab2626", household: "#6b7270", business: "#12181a",
};

export default function MapView() {
  const { refreshKey } = useApp();
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [demand, setDemand] = useState([]);

  useEffect(() => {
    api.getLocations().then(setLocations).catch(console.error);
    api.getUsers().then(setUsers).catch(console.error);
    api.getInventory().then(setInventory).catch(console.error);
    api.getDemand().then(setDemand).catch(console.error);
  }, [refreshKey]);

  const center = locations.length
    ? [locations.reduce((s, l) => s + l.lat, 0) / locations.length, locations.reduce((s, l) => s + l.lng, 0) / locations.length]
    : [12.97, 77.6];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Local Food Map</h1>
        <p className="text-sm text-muted">Discovery and transparency — click any marker for details.</p>
      </div>

      <div className="card overflow-hidden" style={{ height: 560 }}>
        <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {locations.map((loc) => {
            const user = users.find((u) => u.location_id === loc.id);
            const supply = inventory.filter((i) => i.location_id === loc.id && i.quantity > 0);
            const need = demand.filter((d) => d.location_id === loc.id && d.status === "open");
            return (
              <CircleMarker
                key={loc.id}
                center={[loc.lat, loc.lng]}
                radius={9}
                pathOptions={{ color: TYPE_COLOR[loc.type] || "#12181a", fillColor: TYPE_COLOR[loc.type] || "#12181a", fillOpacity: 0.75, weight: 2 }}
              >
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <div className="font-bold">{loc.name}</div>
                    <div className="text-xs uppercase text-muted">{loc.type}</div>
                    {supply.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[11px] font-semibold uppercase text-muted">Available food</div>
                        {supply.map((s) => <div key={s.id} className="text-sm">{s.food_item}: {s.quantity} {s.unit}</div>)}
                      </div>
                    )}
                    {need.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[11px] font-semibold uppercase text-muted">Current demand</div>
                        {need.map((d) => <div key={d.id} className="text-sm">{d.food_item}: need {d.quantity - d.quantity_received} kg</div>)}
                      </div>
                    )}
                    {supply.length === 0 && need.length === 0 && (
                      <div className="mt-2 text-sm text-muted">No active supply or demand.</div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {Object.entries(TYPE_COLOR).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}
