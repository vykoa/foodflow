import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import StatTile from "../components/StatTile";

export default function Impact() {
  const { refreshKey } = useApp();
  const [impact, setImpact] = useState(null);

  useEffect(() => { api.getImpact().then(setImpact).catch(console.error); }, [refreshKey]);

  if (!impact) return <p className="text-sm text-muted">Loading impact metrics…</p>;

  const chartData = [
    { name: "Available", value: impact.food_available_today, color: "#12181a" },
    { name: "Delivered", value: impact.food_allocated, color: "#2f7d3f" },
    { name: "Rescued", value: impact.food_rescued, color: "#4d9d5c" },
    { name: "At Risk", value: impact.at_risk_of_waste, color: "#c1841c" },
    { name: "Unmet", value: impact.unmet_demand, color: "#ab2626" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Impact</h1>
        <p className="text-sm text-muted">
          Every figure below is derived from completed deliveries and live inventory/demand — not simulated
          counters. Food only counts as delivered once a distributor has actually moved it.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Food Delivered" value={`${impact.food_redistributed} kg`} tone="brand" />
        <StatTile label="Food Rescued" value={`${impact.food_rescued} kg`} tone="brand" />
        <StatTile
          label="In Transit"
          value={`${impact.food_in_transit} kg`}
          sub={`${impact.transactions_in_progress} in progress`}
          tone="amber"
        />
        <StatTile label="Distance Avoided" value={`${impact.distance_avoided_km} km`} sub="estimate" />
        <StatTile label="Est. CO2 Avoided" value={`${impact.co2_avoided_kg} kg`} sub="estimate" tone="brand" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Local Food Network — Snapshot</h2>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="#eeece5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip formatter={(v) => `${v} kg`} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Transparency Summary</h2>
          <dl className="mt-3 divide-y divide-line text-sm">
            {[
              ["Available today", `${impact.food_available_today} kg`],
              ["Delivered", `${impact.food_allocated} kg`],
              ["In transit", `${impact.food_in_transit} kg`],
              ["At risk of waste", `${impact.at_risk_of_waste} kg`],
              ["Unmet demand", `${impact.unmet_demand} kg`],
              ["Food rescued", `${impact.food_rescued} kg`],
              ["Completed deliveries", impact.allocation_count],
              ["Transactions in progress", impact.transactions_in_progress],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2">
                <dt className="text-muted">{label}</dt>
                <dd className="font-mono font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-muted">
            Distance and CO2 figures are simplified estimates for demonstration purposes, based on assumed
            truck capacity ({" "}
            500 kg/trip) and an average emissions factor — not live transport telemetry.
          </p>
        </div>
      </div>
    </div>
  );
}
