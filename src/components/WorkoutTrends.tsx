import React, { useState, useMemo } from "react";
import { User, WorkoutDay } from "../types";
import { ChevronDown, ChevronUp } from "lucide-react";

interface WorkoutTrendsProps {
  users: User[];
  workoutDays: WorkoutDay[];
  currentWeek: number;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const WorkoutTrends: React.FC<WorkoutTrendsProps> = ({
  users,
  workoutDays,
  currentWeek,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const weeklyTotals = useMemo(() => {
    const totals: number[] = [];
    for (let w = 1; w <= currentWeek; w++) {
      totals.push(
        workoutDays.filter((d) => d.week === w && d.isCompleted).length
      );
    }
    return totals;
  }, [workoutDays, currentWeek]);

  const weeklyMax = useMemo(
    () => Math.max(...weeklyTotals, 1),
    [weeklyTotals]
  );

  const weeklyAvg = useMemo(() => {
    if (weeklyTotals.length === 0) return 0;
    return weeklyTotals.reduce((a, b) => a + b, 0) / weeklyTotals.length;
  }, [weeklyTotals]);

  const dayTotals = useMemo(() => {
    const counts = new Array(7).fill(0);
    workoutDays.forEach((d) => {
      if (d.isCompleted && d.dayOfWeek >= 1 && d.dayOfWeek <= 7) {
        counts[d.dayOfWeek - 1]++;
      }
    });
    return counts;
  }, [workoutDays]);

  const dayMax = useMemo(() => Math.max(...dayTotals, 1), [dayTotals]);

  // --- SVG dimensions for the weekly bar chart ---
  const barChartPadding = { top: 16, right: 12, bottom: 28, left: 36 };
  const barWidth = Math.max(8, Math.min(20, 600 / currentWeek - 2));
  const barGap = Math.max(2, Math.min(4, barWidth * 0.3));
  const chartInnerWidth = currentWeek * (barWidth + barGap) - barGap;
  const svgWidth = barChartPadding.left + chartInnerWidth + barChartPadding.right;
  const chartHeight = 160;
  const svgHeight = barChartPadding.top + chartHeight + barChartPadding.bottom;

  const avgY =
    barChartPadding.top + chartHeight - (weeklyAvg / weeklyMax) * chartHeight;

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold text-gray-900">Workout Trends</h2>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-8">
          {/* ── Visualization 1: Group Workout Trend ── */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Workouts per Week (all users)
            </h3>
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <svg
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                style={{ display: "block", minWidth: svgWidth }}
                role="img"
                aria-label="Group workout trend bar chart"
              >
                <defs>
                  <linearGradient
                    id="barGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>

                {/* Average line */}
                <line
                  x1={barChartPadding.left}
                  y1={avgY}
                  x2={barChartPadding.left + chartInnerWidth}
                  y2={avgY}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                  strokeDasharray="4,3"
                />
                <text
                  x={barChartPadding.left - 4}
                  y={avgY + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill="#9ca3af"
                >
                  avg {Math.round(weeklyAvg)}
                </text>

                {/* Bars */}
                {weeklyTotals.map((total, i) => {
                  const barH = (total / weeklyMax) * chartHeight;
                  const x =
                    barChartPadding.left + i * (barWidth + barGap);
                  const y = barChartPadding.top + chartHeight - barH;
                  const weekNum = i + 1;
                  const showLabel =
                    currentWeek <= 12
                      ? weekNum % 2 === 1 || weekNum === currentWeek
                      : weekNum % 4 === 0 || weekNum === 1 || weekNum === currentWeek;

                  return (
                    <g key={i}>
                      <title>
                        Week {weekNum}: {total} workouts
                      </title>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={Math.max(barH, 1)}
                        rx={2}
                        fill="url(#barGradient)"
                        className="transition-all"
                      />
                      {showLabel && (
                        <text
                          x={x + barWidth / 2}
                          y={svgHeight - 4}
                          textAnchor="middle"
                          fontSize={9}
                          fill="#9ca3af"
                        >
                          {weekNum}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Y-axis baseline */}
                <line
                  x1={barChartPadding.left}
                  y1={barChartPadding.top + chartHeight}
                  x2={barChartPadding.left + chartInnerWidth}
                  y2={barChartPadding.top + chartHeight}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
              </svg>
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
              <span>
                Peak:{" "}
                <strong className="text-gray-700">{weeklyMax}</strong> workouts
                (Week{" "}
                {weeklyTotals.indexOf(weeklyMax) + 1})
              </span>
              <span>
                Average:{" "}
                <strong className="text-gray-700">
                  {weeklyAvg.toFixed(1)}
                </strong>{" "}
                / week
              </span>
              <span>
                Total:{" "}
                <strong className="text-gray-700">
                  {weeklyTotals.reduce((a, b) => a + b, 0)}
                </strong>
              </span>
            </div>
          </div>

          {/* ── Visualization 2: Best Workout Day ── */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Most Popular Workout Day
            </h3>
            <div className="space-y-2">
              {DAY_LABELS.map((label, i) => {
                const count = dayTotals[i];
                const pct = (count / dayMax) * 100;
                const isBest = count === dayMax && count > 0;

                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-8 text-xs font-medium text-gray-600 text-right shrink-0">
                      {label}
                    </span>
                    <div className="flex-1 h-6 bg-gray-50 rounded overflow-hidden relative">
                      <div
                        className={`h-full rounded transition-all ${
                          isBest
                            ? "bg-green-500"
                            : "bg-green-400"
                        }`}
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                      {count > 0 && (
                        <span
                          className={`absolute top-0 h-full flex items-center text-xs font-medium ${
                            pct > 20
                              ? "text-white pl-2 left-0"
                              : "text-gray-600 pl-1"
                          }`}
                          style={pct <= 20 ? { left: `${pct}%` } : undefined}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {(() => {
                const bestIdx = dayTotals.indexOf(dayMax);
                return dayMax > 0
                  ? `${DAY_LABELS[bestIdx]} is the group's favourite workout day`
                  : "No workouts recorded yet";
              })()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutTrends;
