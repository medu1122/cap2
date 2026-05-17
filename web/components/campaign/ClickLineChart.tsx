"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatDate } from "@/lib/utils";

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
  if (loading) {
    return (
      <div className="h-52 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Đang tải biểu đồ...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100">
        <div className="text-center">
          <div className="text-gray-300 text-3xl mb-2">📊</div>
          <p className="text-sm text-gray-400">Chưa có dữ liệu click theo thời gian</p>
        </div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: (() => {
      try {
        const [y, m, day] = d.date.split("-");
        return `${day}/${m}`;
      } catch {
        return d.date;
      }
    })(),
  }));

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
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
                try {
                  const [y, m, day] = d.date.split("-");
                  return `${formatDate(`${y}-${m}-${day}`)}`;
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
          <Line
            type="monotone"
            dataKey="email_clicks"
            stroke="#7EB5A6"
            strokeWidth={2}
            dot={{ r: 3, fill: "#7EB5A6" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="facebook_clicks"
            stroke="#93C5FD"
            strokeWidth={2}
            dot={{ r: 3, fill: "#93C5FD" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
