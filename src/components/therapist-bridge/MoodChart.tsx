import { memo, useMemo } from "react";
import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmotionalProfile } from "@/lib/types/therapist-bridge";

interface MoodChartProps {
  data: EmotionalProfile["moodTrends"];
}

const MoodChart = ({ data }: MoodChartProps) => {
  const chartData = useMemo(
    () =>
      data.map((entry) => ({
        ...entry,
        label: format(new Date(entry.date), "MMM d"),
      })),
    [data],
  );

  return (
    <div className="h-72 w-full" aria-label="Mood trends chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
          <XAxis dataKey="label" minTickGap={18} stroke="hsl(var(--muted-foreground))" />
          <YAxis domain={[1, 10]} stroke="hsl(var(--muted-foreground))" />
          <Tooltip />
          <Line type="monotone" dataKey="mood" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default memo(MoodChart);