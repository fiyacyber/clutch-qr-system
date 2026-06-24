"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#FFA665", "#0b1f35", "#9BA5B5", "#D4DAE4"];

const DEMO = [
  { label: "iPhone",  value: 58 },
  { label: "Android", value: 34 },
  { label: "Desktop", value: 6 },
  { label: "Other",   value: 2 },
];

interface DeviceDonutProps {
  data: { label: string; value: number }[];
}

export default function DeviceDonut({ data }: DeviceDonutProps) {
  const display = data.length > 0 ? data.slice(0, 4) : DEMO;
  const total = display.reduce((a, d) => a + d.value, 0);
  const isDemo = data.length === 0;

  return (
    <div className="ca-donut-wrap">
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie
            data={display}
            cx="50%"
            cy="50%"
            innerRadius={42}
            outerRadius={68}
            dataKey="value"
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
          >
            {display.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, _name, entry) => {
              const num = Number(v) || 0;
              return [
                `${Math.round((num / total) * 100)}%${!isDemo ? ` (${num})` : ""}`,
                (entry as any)?.payload?.label ?? "",
              ];
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="ca-donut-legend">
        {display.map((d, i) => (
          <div key={d.label} className="ca-donut-row">
            <span className="ca-donut-dot" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="ca-donut-name">{d.label}</span>
            <span className="ca-donut-pct">
              {Math.round((d.value / total) * 100)}%
              {!isDemo ? ` (${d.value.toLocaleString()})` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
