import React, { useState, useMemo } from "react";
import { User, Goal, WorkoutDay, getRequiredWorkouts } from "../types";
import { getCurrentWeek } from "../utils/dateUtils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface HeadToHeadProps {
  users: User[];
  goals: Goal[];
  workoutDays: WorkoutDay[];
}

interface UserStats {
  user: User;
  totalPoints: number;
  cleanWeeks: number;
  missedWeeks: number;
  goalsCompleted: number;
  totalWorkouts: number;
  consistencyLevel: number;
  completionRate: number;
}

type Winner = "a" | "b" | "tie";

interface StatRow {
  label: string;
  valueA: string;
  valueB: string;
  rawA: number;
  rawB: number;
  lowerIsBetter: boolean;
}

function computeStats(
  user: User,
  goals: Goal[],
  workoutDays: WorkoutDay[],
  currentWeek: number,
): UserStats {
  const userGoals = goals.filter((g) => g.userId === user.id);
  const goalsCompleted = userGoals.filter((g) => g.isCompleted).length;

  const completedWorkouts = workoutDays.filter(
    (w) => w.userId === user.id && w.isCompleted,
  );
  const totalWorkouts = completedWorkouts.length;

  const required = getRequiredWorkouts(user.currentConsistencyLevel);
  const totalPossible = currentWeek * required;
  const completionRate = totalPossible > 0 ? totalWorkouts / totalPossible : 0;

  return {
    user,
    totalPoints: user.totalPoints,
    cleanWeeks: user.cleanWeeks,
    missedWeeks: user.missedWeeks,
    goalsCompleted,
    totalWorkouts,
    consistencyLevel: user.currentConsistencyLevel,
    completionRate,
  };
}

const HeadToHead: React.FC<HeadToHeadProps> = ({
  users,
  goals,
  workoutDays,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeUsers = useMemo(
    () =>
      users
        .filter((u) => u.isActive)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const [userAId, setUserAId] = useState<string>(activeUsers[0]?.id ?? "");
  const [userBId, setUserBId] = useState<string>(activeUsers[1]?.id ?? "");

  const currentWeek = useMemo(() => getCurrentWeek(), []);

  const statsA = useMemo(() => {
    const user = users.find((u) => u.id === userAId);
    return user ? computeStats(user, goals, workoutDays, currentWeek) : null;
  }, [userAId, users, goals, workoutDays, currentWeek]);

  const statsB = useMemo(() => {
    const user = users.find((u) => u.id === userBId);
    return user ? computeStats(user, goals, workoutDays, currentWeek) : null;
  }, [userBId, users, goals, workoutDays, currentWeek]);

  const rows: StatRow[] = useMemo(() => {
    if (!statsA || !statsB) return [];
    return [
      {
        label: "Total Points",
        valueA: String(statsA.totalPoints),
        valueB: String(statsB.totalPoints),
        rawA: statsA.totalPoints,
        rawB: statsB.totalPoints,
        lowerIsBetter: false,
      },
      {
        label: "Clean Weeks",
        valueA: String(statsA.cleanWeeks),
        valueB: String(statsB.cleanWeeks),
        rawA: statsA.cleanWeeks,
        rawB: statsB.cleanWeeks,
        lowerIsBetter: false,
      },
      {
        label: "Missed Weeks",
        valueA: String(statsA.missedWeeks),
        valueB: String(statsB.missedWeeks),
        rawA: statsA.missedWeeks,
        rawB: statsB.missedWeeks,
        lowerIsBetter: true,
      },
      {
        label: "Goals Completed",
        valueA: String(statsA.goalsCompleted),
        valueB: String(statsB.goalsCompleted),
        rawA: statsA.goalsCompleted,
        rawB: statsB.goalsCompleted,
        lowerIsBetter: false,
      },
      {
        label: "Total Workouts",
        valueA: String(statsA.totalWorkouts),
        valueB: String(statsB.totalWorkouts),
        rawA: statsA.totalWorkouts,
        rawB: statsB.totalWorkouts,
        lowerIsBetter: false,
      },
      {
        label: "Consistency Level",
        valueA: `Level ${statsA.consistencyLevel}`,
        valueB: `Level ${statsB.consistencyLevel}`,
        rawA: statsA.consistencyLevel,
        rawB: statsB.consistencyLevel,
        lowerIsBetter: true,
      },
      {
        label: "Completion Rate",
        valueA: `${Math.round(statsA.completionRate * 100)}%`,
        valueB: `${Math.round(statsB.completionRate * 100)}%`,
        rawA: statsA.completionRate,
        rawB: statsB.completionRate,
        lowerIsBetter: false,
      },
    ];
  }, [statsA, statsB]);

  function getWinner(row: StatRow): Winner {
    if (row.rawA === row.rawB) return "tie";
    if (row.lowerIsBetter) return row.rawA < row.rawB ? "a" : "b";
    return row.rawA > row.rawB ? "a" : "b";
  }

  const scoreA = rows.filter((r) => getWinner(r) === "a").length;
  const scoreB = rows.filter((r) => getWinner(r) === "b").length;

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold text-gray-900">Head to Head</h2>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4">
          {/* User selectors */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Player A
              </label>
              <div className="relative">
                <select
                  value={userAId}
                  onChange={(e) => setUserAId(e.target.value)}
                  className="appearance-none w-full bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.avatar} {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-end justify-center pb-1">
              <span className="text-sm font-bold text-gray-400">VS</span>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Player B
              </label>
              <div className="relative">
                <select
                  value={userBId}
                  onChange={(e) => setUserBId(e.target.value)}
                  className="appearance-none w-full bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.avatar} {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {statsA && statsB && userAId !== userBId ? (
            <>
              {/* Score header */}
              <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs">
                    {statsA.user.avatar || statsA.user.name.charAt(0)}
                  </div>
                  <span className="font-semibold text-sm text-gray-900">
                    {statsA.user.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xl font-bold ${scoreA > scoreB ? "text-green-600" : "text-gray-400"}`}
                  >
                    {scoreA}
                  </span>
                  <span className="text-gray-300">–</span>
                  <span
                    className={`text-xl font-bold ${scoreB > scoreA ? "text-green-600" : "text-gray-400"}`}
                  >
                    {scoreB}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">
                    {statsB.user.name}
                  </span>
                  <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs">
                    {statsB.user.avatar || statsB.user.name.charAt(0)}
                  </div>
                </div>
              </div>

              {/* Comparison rows */}
              <div className="space-y-1.5">
                {rows.map((row) => {
                  const winner = getWinner(row);
                  return (
                    <div
                      key={row.label}
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm"
                    >
                      <div
                        className={`text-right px-3 py-2 rounded-l-lg font-medium ${
                          winner === "a"
                            ? "bg-green-50 text-green-700 font-bold"
                            : "text-gray-700"
                        }`}
                      >
                        {row.valueA}
                      </div>
                      <div className="px-2 py-2 text-center text-xs text-gray-500 font-medium whitespace-nowrap">
                        {row.label}
                      </div>
                      <div
                        className={`text-left px-3 py-2 rounded-r-lg font-medium ${
                          winner === "b"
                            ? "bg-green-50 text-green-700 font-bold"
                            : "text-gray-700"
                        }`}
                      >
                        {row.valueB}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : userAId === userBId ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              Pick two different players to compare.
            </p>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">
              Select two active players above.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default HeadToHead;
