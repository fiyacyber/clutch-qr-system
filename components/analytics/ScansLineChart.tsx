"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface ScansLineChartProps {
  data: { date: string; scans: number }[];
}

function fmtDate(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: "1px solid #e8edf4", borderRadius: 8,
      padding: "8px 12px", boxShadow: "0 4px 16px rgba(0,0,0,.10)",
    }}>
      <p style={{ margin: 0, color: "#384862", fontWeight: 700, fontSize: 12 }}>{fmtDate(label)}</p>
      <p style={{ margin: "4px 0 0", color: "#FF7A1A", fontWeight: 900, fontSize: 15 }}>
        {payload[0].value} scans
      </p>
    </div>
  );
}

export default function ScansLineChart({ data }: ScansLineChartProps) {
  const interval = Math.max(Math.floor(data.length / 6) - 1, 0);
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="scanFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#FFA665" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#FFA665" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F5" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={{ fontSize: 11, fill: "#9BA5B5" }}
          axisLine={false}
          tickLine={false}
          interval={interval}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9BA5B5" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="scans"
          stroke="#FF7A1A"
          strokeWidth={2}
          fill="url(#scanFill)"
          dot={false}
          activeDot={{ r: 4, fill: "#FF7A1A", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
