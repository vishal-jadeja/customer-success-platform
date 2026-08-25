"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SENTIMENT_HEX } from "@/lib/colors";
import { buildTrendSeries } from "@/lib/trend";
import { sentiments } from "@/schemas/interaction";
import type { SentimentTrendPoint } from "@/store/slices/dashboardSlice";

export default function SentimentTrendChart({
  points,
  days,
}: {
  points: SentimentTrendPoint[];
  days: number;
}) {
  const rows = useMemo(() => buildTrendSeries(points, days), [points, days]);

  // Self-guards against an empty series so it can never be handed [] and
  // throw — the page's DashboardSection supplies the actual empty message.
  if (rows.length === 0) return null;

  return (
    // Fixed-height wrapper is required: ResponsiveContainer measures its
    // parent, and a percentage-height parent with no resolved height renders
    // the chart 0px tall.
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={24}
            tick={{ fontSize: 12 }}
          />
          <YAxis allowDecimals={false} width={32} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {sentiments.map((s) => (
            <Line
              key={s}
              type="monotone"
              dataKey={s}
              stroke={SENTIMENT_HEX[s]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
