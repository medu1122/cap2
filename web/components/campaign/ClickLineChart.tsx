"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DataPoint {
  date: string;
  email_clicks: number;
  facebook_clicks: number;
}

interface Props {
  data: DataPoint[];
  loading?: boolean;
}

export default function ClickLineChart({ data, loading }: Props) {
  const chartData = data.length > 0
    ? data.map((d) => ({
        ...d,
        label: (() => {
          try {
            const [y, m, day] = d.date.split("-");
            return `${day}/${m}`;
          } catch {
            return d.date;
          }
        })(),
      }))
    : [
        { date: "", label: "—", email_clicks: 0, facebook_clicks: 0 },
      ];

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                email_clicks: "Email click",
                facebook_clicks: "Facebook click",
              };
              return [value, labels[name] || name];
            }}
            labelFormatter={(_, payload) => {
              if (payload && payload[0]) {
                const d = payload[0].payload as DataPoint & { label: string };
                if (!d.date) return "Chưa có dữ liệu";
                try {
                  const [y, m, day] = d.date.split("-");
                  const formatted = new Date(`${y}-${m}-${day}`).toLocaleDateString("vi-VN");
                  return formatted;
                } catch {
                  return d.date;
                }
              }
              return "";
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                email_clicks: "Email",
                facebook_clicks: "Facebook",
              };
              return labels[value] || value;
            }}
          />
          <Bar dataKey="email_clicks" fill="#7EB5A6" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="facebook_clicks" fill="#93C5FD" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
