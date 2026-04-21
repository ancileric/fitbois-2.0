import React, { useState, useMemo } from "react";
import { User, WorkoutDay, WeeklyPlan, AdminSettings, getRequiredWorkouts } from "../types";
import {
  CheckCircle,
  XCircle,
  Users,
  Calendar,
  ChevronDown,
  Activity,
  Target,
  Lock,
} from "lucide-react";
import { getCurrentWeek, getDaysUntilStart, getWeekDates, formatDayLabel } from "../utils/dateUtils";
import { calculateAllWeekStatuses } from "../utils/consistencyCalculator";
import WeeklyPlanModal, { PlanLockReason } from "./WeeklyPlanModal";

interface WorkoutProps {
  users: User[];
  workoutDays: WorkoutDay[];
  weeklyPlans: WeeklyPlan[];
  adminSettings: AdminSettings;
  onUpdateWorkoutDay: (workoutDay: WorkoutDay) => void;
  onUpdateWeeklyPlan: (plan: {
    userId: string;
    week: number;
    committedDays: number[];
    createdBy?: "user" | "admin";
  }) => Promise<WeeklyPlan | undefined> | Promise<WeeklyPlan>;
}

// Returns 1 (Monday) through 7 (Sunday) in IST — mirrors backend.
const currentISTDayOfWeek = (): number => {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const jsDow = istNow.getUTCDay();
  return jsDow === 0 ? 7 : jsDow;
};

const Workout: React.FC<WorkoutProps> = ({
  users,
  workoutDays,
  weeklyPlans,
  adminSettings,
  onUpdateWorkoutDay,
  onUpdateWeeklyPlan,
}) => {
  const [planModalUserId, setPlanModalUserId] = useState<string | null>(null);
  // Calculate current week first so we can use it for initial state
  const currentWeek = getCurrentWeek(adminSettings.challengeStartDate);
  const [selectedWeek, setSelectedWeek] = useState(() =>
    currentWeek > 0 ? currentWeek : 1,
  );

  // Calculate total weeks
  const startDate = new Date(adminSettings.challengeStartDate);
  const endDate = new Date(adminSettings.challengeEndDate);
  const totalWeeks = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );

  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekDates = getWeekDates(adminSettings.challengeStartDate, selectedWeek);

  // Get workout data for a specific user, week, and day
  const getWorkoutDay = (
    userId: string,
    week: number,
    dayOfWeek: number,
  ): WorkoutDay | null => {
    return (
      workoutDays.find(
        (w) =>
          w.userId === userId && w.week === week && w.dayOfWeek === dayOfWeek,
      ) || null
    );
  };

  // Cycle through: empty → workout → steps → empty
  // Only 1 steps day allowed per user per week; if slot taken, workout cycles to empty instead.
  const cycleWorkout = (user: User, week: number, dayOfWeek: number) => {
    const userId = user.id;
    const existing = getWorkoutDay(userId, week, dayOfWeek);
    const date = new Date(startDate.getTime());
    date.setDate(date.getDate() + (week - 1) * 7 + (dayOfWeek - 1));

    const stepsThisWeek = workoutDays.filter(
      (w) =>
        w.userId === userId &&
        w.week === week &&
        w.isCompleted &&
        w.workoutType === "steps",
    ).length;

    let isCompleted: boolean;
    let workoutType: string | undefined;

    if (!existing || !existing.isCompleted) {
      // empty → workout
      isCompleted = true;
      workoutType = "workout";
    } else if (existing.workoutType !== "steps" && stepsThisWeek === 0) {
      // workout → steps (steps slot available)
      isCompleted = true;
      workoutType = "steps";
    } else if (existing.workoutType !== "steps" && stepsThisWeek > 0) {
      // workout → empty (steps slot already taken by another day)
      isCompleted = false;
      workoutType = undefined;
    } else {
      // steps → empty
      isCompleted = false;
      workoutType = undefined;
    }

    const workoutDay: WorkoutDay = {
      id:
        existing?.id || `workout-${userId}-${week}-${dayOfWeek}-${Date.now()}`,
      userId,
      week,
      dayOfWeek,
      date: date.toISOString().split("T")[0],
      isCompleted,
      markedBy: "admin",
      timestamp: new Date().toISOString(),
      workoutType,
      notes: existing?.notes,
    };

    onUpdateWorkoutDay(workoutDay);
  };

  // Simulated week statuses per user — historically accurate required workouts per week
  const userWeekStatusesMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateAllWeekStatuses>>();
    users.forEach((user) => {
      map.set(user.id, calculateAllWeekStatuses(user, workoutDays, currentWeek));
    });
    return map;
  }, [users, workoutDays, currentWeek]);

  // Calculate weekly stats for each user using database data
  const getUserWeekStats = (userId: string, week: number) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return { completed: 0, required: 5, isComplete: false };

    // For past weeks, use the historically-simulated level (not current level)
    if (week < currentWeek) {
      const weekStatuses = userWeekStatusesMap.get(userId) || [];
      const weekStatus = weekStatuses[week - 1];
      if (weekStatus) {
        return {
          completed: weekStatus.completedWorkouts,
          required: weekStatus.requiredWorkouts,
          isComplete: weekStatus.isComplete,
        };
      }
    }

    // For the current/future weeks, use the user's current level
    const level = user.currentConsistencyLevel;
    const requiredDays = getRequiredWorkouts(level);
    const effectiveWorkouts = workoutDays.filter(
      (w) =>
        w.userId === userId &&
        w.week === week &&
        w.isCompleted &&
        (level >= 5 || w.workoutType !== "steps"),
    ).length;

    return {
      completed: effectiveWorkouts,
      required: requiredDays,
      isComplete: effectiveWorkouts >= requiredDays,
    };
  };

  // Stats summary - calculates completion based on individual requirements from database
  const weeklyStats = useMemo(() => {
    return weeks.map((week) => {
      const activeUsers = users.filter((u) => u.isActive);

      if (activeUsers.length === 0) {
        return {
          week,
          totalUsers: 0,
          completedUsers: 0,
          completionRate: 0,
          totalWorkoutsRequired: 0,
          totalWorkoutsCompleted: 0,
        };
      }

      let totalWorkoutsRequired = 0;
      let totalWorkoutsCompleted = 0;
      let usersWhoMetRequirement = 0;

      activeUsers.forEach((user) => {
        let requiredWorkouts: number;
        let completedWorkouts: number;

        if (week < currentWeek) {
          // For past weeks, use the historically-simulated required workouts
          const weekStatuses = userWeekStatusesMap.get(user.id) || [];
          const weekStatus = weekStatuses[week - 1];
          if (weekStatus) {
            requiredWorkouts = weekStatus.requiredWorkouts;
            completedWorkouts = weekStatus.completedWorkouts;
          } else {
            requiredWorkouts = getRequiredWorkouts(user.currentConsistencyLevel);
            completedWorkouts = 0;
          }
        } else {
          // For current/future weeks, use the user's current level
          const level = user.currentConsistencyLevel;
          requiredWorkouts = getRequiredWorkouts(level);
          // Steps don't count toward the requirement at level 4/3
          completedWorkouts = workoutDays.filter(
            (w) =>
              w.userId === user.id &&
              w.week === week &&
              w.isCompleted &&
              (level >= 5 || w.workoutType !== "steps"),
          ).length;
        }

        totalWorkoutsRequired += requiredWorkouts;
        totalWorkoutsCompleted += completedWorkouts;

        // Check if user met their individual requirement
        if (completedWorkouts >= requiredWorkouts) {
          usersWhoMetRequirement++;
        }
      });

      return {
        week,
        totalUsers: activeUsers.length,
        completedUsers: usersWhoMetRequirement,
        completionRate:
          totalWorkoutsRequired > 0
            ? (totalWorkoutsCompleted / totalWorkoutsRequired) * 100
            : 0,
        totalWorkoutsRequired,
        totalWorkoutsCompleted,
      };
    });
  }, [users, workoutDays, weeks, currentWeek, userWeekStatusesMap]);

  // Look up a user's plan for the selected week.
  const getPlanFor = (userId: string): WeeklyPlan | null => {
    return (
      weeklyPlans.find(
        (p) => p.userId === userId && p.week === selectedWeek,
      ) || null
    );
  };

  // Determine if/why a plan is locked for this user + selectedWeek.
  const getLockReason = (userId: string): PlanLockReason => {
    if (currentWeek > 0 && selectedWeek < currentWeek) return "past-week";
    if (selectedWeek > currentWeek) return null; // future week always editable
    // selectedWeek === currentWeek
    if (currentISTDayOfWeek() > 1) return "monday-ended";
    const hasWorkout = workoutDays.some(
      (w) =>
        w.userId === userId &&
        w.week === selectedWeek &&
        w.isCompleted,
    );
    if (hasWorkout) return "workout-logged";
    return null;
  };

  // For a committed day in a past week, has the user satisfied it?
  const didCommitHit = (
    userId: string,
    week: number,
    day: number,
    level: number,
  ): boolean => {
    return workoutDays.some(
      (w) =>
        w.userId === userId &&
        w.week === week &&
        w.dayOfWeek === day &&
        w.isCompleted &&
        (level >= 5 || w.workoutType !== "steps"),
    );
  };

  const planModalUser = planModalUserId
    ? users.find((u) => u.id === planModalUserId) || null
    : null;
  const planModalExistingPlan = planModalUser
    ? getPlanFor(planModalUser.id)
    : null;
  const planModalLockReason: PlanLockReason = planModalUser
    ? getLockReason(planModalUser.id)
    : null;

  return (
    <div className="space-y-4">
      {/* Header with inline stats */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Workouts</h1>
        <div className="mt-4 bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {users.filter((u) => u.isActive).length} active
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {currentWeek <= 0
                    ? `Starts in ${getDaysUntilStart(adminSettings.challengeStartDate)} days`
                    : `Week ${currentWeek}`}
                </span>
              </div>
            </div>
            {currentWeek > 0 && weeklyStats[Math.max(0, currentWeek - 1)] && (
              <span className="text-sm font-medium text-gray-900">
                {weeklyStats[
                  Math.max(0, currentWeek - 1)
                ].completionRate.toFixed(0)}
                % complete
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Workout Tracking Grid */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        {/* Week Selector Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Week {selectedWeek}
          </h2>
          <div className="relative">
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              {weeks.map((week) => {
                const stats = weeklyStats[week - 1];
                const isCurrent = currentWeek > 0 && week === currentWeek;
                return (
                  <option key={week} value={week}>
                    Week {week}
                    {isCurrent ? " (Current)" : ""} - {stats.completedUsers}/
                    {stats.totalUsers}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {users
            .filter((u) => u.isActive)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((user) => {
              const weekStats = getUserWeekStats(user.id, selectedWeek);

              return (
                <div
                  key={user.id}
                  className={`p-4 rounded-lg border ${
                    weekStats.isComplete
                      ? "bg-green-50 border-green-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  {/* User Info Row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {user.avatar || user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            {user.name}
                          </span>
                          {weekStats.isComplete && (
                            <span className="text-green-600">✅</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Level {user.currentConsistencyLevel} •{" "}
                          {user.cleanWeeks} clean weeks
                        </div>
                      </div>
                    </div>
                    <div
                      className={`text-sm font-bold ${
                        weekStats.isComplete
                          ? "text-green-600"
                          : "text-gray-600"
                      }`}
                    >
                      {weekStats.completed}/{weekStats.required}
                    </div>
                  </div>

                  {/* Plan strip */}
                  {(() => {
                    const plan = getPlanFor(user.id);
                    const lockReason = getLockReason(user.id);
                    const editable = lockReason === null;
                    const level = user.currentConsistencyLevel;
                    const isPast = selectedWeek < currentWeek;

                    return (
                      <div className="mb-3 flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Target size={14} className="text-primary-500 shrink-0" />
                          {plan ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {plan.committedDays.map((d) => {
                                const hit = didCommitHit(
                                  user.id,
                                  selectedWeek,
                                  d,
                                  level,
                                );
                                const baseCls =
                                  "text-xs font-medium rounded px-1.5 py-0.5";
                                const cls = isPast
                                  ? hit
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                  : hit
                                    ? "bg-green-100 text-green-800"
                                    : "bg-primary-50 text-primary-700";
                                return (
                                  <span
                                    key={d}
                                    className={`${baseCls} ${cls}`}
                                  >
                                    {daysOfWeek[d - 1]}
                                    {isPast && !hit ? " ✗" : hit ? " ✓" : ""}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">
                              {editable
                                ? "No plan yet this week"
                                : "No plan — bonus unavailable"}
                            </span>
                          )}
                        </div>
                        {editable ? (
                          <button
                            onClick={() => setPlanModalUserId(user.id)}
                            className="text-xs font-medium text-primary-600 hover:text-primary-700 shrink-0"
                          >
                            {plan ? "Edit plan" : "Commit →"}
                          </button>
                        ) : (
                          !isPast && (
                            <Lock size={12} className="text-gray-400 shrink-0" />
                          )
                        )}
                      </div>
                    );
                  })()}

                  {/* Days Row */}
                  <div className="flex justify-between items-center">
                    {daysOfWeek.map((day, dayIndex) => {
                      const workoutDay = getWorkoutDay(
                        user.id,
                        selectedWeek,
                        dayIndex + 1,
                      );
                      const isCompleted = workoutDay?.isCompleted || false;
                      const isSteps = isCompleted && workoutDay?.workoutType === "steps";
                      const plan = getPlanFor(user.id);
                      const isCommitted = plan?.committedDays.includes(dayIndex + 1) || false;

                      return (
                        <div key={day} className="flex flex-col items-center">
                          <span className="text-xs font-medium text-gray-500">
                            {day.charAt(0)}
                          </span>
                          <span className="text-xs text-gray-400 mb-1">
                            {formatDayLabel(weekDates[dayIndex]).split(' ')[1]}
                          </span>
                          <button
                            onClick={() =>
                              cycleWorkout(user, selectedWeek, dayIndex + 1)
                            }
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                              isCommitted ? "ring-2 ring-primary-500 ring-offset-1" : ""
                            } ${
                              isSteps
                                ? "bg-blue-500 text-white"
                                : isCompleted
                                  ? "bg-green-500 text-white"
                                  : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            {isSteps ? (
                              <Activity size={18} />
                            ) : isCompleted ? (
                              <CheckCircle size={18} />
                            ) : (
                              <XCircle size={18} />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-900 w-64">
                  Participant
                </th>
                <th className="text-center py-3 px-3 font-medium text-gray-900 w-16">
                  Level
                </th>
                {daysOfWeek.map((day, dayIndex) => (
                  <th
                    key={day}
                    className="text-center py-3 px-3 font-medium text-gray-900 w-16"
                  >
                    <div>{day}</div>
                    <div className="text-xs font-normal text-gray-500">{formatDayLabel(weekDates[dayIndex])}</div>
                  </th>
                ))}
                <th className="text-center py-3 px-4 font-medium text-gray-900 w-20">
                  Progress
                </th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter((u) => u.isActive)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((user) => {
                  const weekStats = getUserWeekStats(user.id, selectedWeek);

                  return (
                    <tr
                      key={user.id}
                      className={`border-b border-gray-100 transition-colors ${
                        weekStats.isComplete
                          ? "bg-green-50 hover:bg-green-100 border-green-200"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm">
                            {user.avatar || user.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">
                                {user.name}
                              </span>
                              {weekStats.isComplete && (
                                <span className="text-green-600 text-sm">
                                  ✅
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {user.cleanWeeks} clean weeks
                              {weekStats.isComplete && (
                                <span className="text-green-600 ml-1">
                                  • Week completed!
                                </span>
                              )}
                            </div>
                            {(() => {
                              const plan = getPlanFor(user.id);
                              const lockReason = getLockReason(user.id);
                              const editable = lockReason === null;
                              const level = user.currentConsistencyLevel;
                              const isPast = selectedWeek < currentWeek;

                              return (
                                <div className="mt-1 flex items-center gap-1 flex-wrap">
                                  <Target size={11} className="text-primary-500 shrink-0" />
                                  {plan ? (
                                    plan.committedDays.map((d) => {
                                      const hit = didCommitHit(
                                        user.id,
                                        selectedWeek,
                                        d,
                                        level,
                                      );
                                      const cls = isPast
                                        ? hit
                                          ? "bg-green-100 text-green-800"
                                          : "bg-red-100 text-red-800"
                                        : hit
                                          ? "bg-green-100 text-green-800"
                                          : "bg-primary-50 text-primary-700";
                                      return (
                                        <span
                                          key={d}
                                          className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${cls}`}
                                        >
                                          {daysOfWeek[d - 1]}
                                          {isPast && !hit ? " ✗" : hit ? " ✓" : ""}
                                        </span>
                                      );
                                    })
                                  ) : (
                                    <span className="text-[11px] text-gray-400">
                                      {editable
                                        ? "No plan yet"
                                        : "No plan — bonus unavailable"}
                                    </span>
                                  )}
                                  {editable ? (
                                    <button
                                      onClick={() => setPlanModalUserId(user.id)}
                                      className="text-[11px] font-medium text-primary-600 hover:text-primary-700 ml-1"
                                    >
                                      {plan ? "edit" : "commit →"}
                                    </button>
                                  ) : !isPast ? (
                                    <Lock size={10} className="text-gray-400 ml-1" />
                                  ) : null}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-3 text-center">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          {user.currentConsistencyLevel}
                        </span>
                      </td>

                      {daysOfWeek.map((day, dayIndex) => {
                        const workoutDay = getWorkoutDay(
                          user.id,
                          selectedWeek,
                          dayIndex + 1,
                        );
                        const isCompleted = workoutDay?.isCompleted || false;
                        const isSteps = isCompleted && workoutDay?.workoutType === "steps";
                        const plan = getPlanFor(user.id);
                        const isCommitted = plan?.committedDays.includes(dayIndex + 1) || false;

                        return (
                          <td key={day} className="py-4 px-3 text-center">
                            <div className="flex justify-center">
                              <button
                                onClick={() =>
                                  cycleWorkout(user, selectedWeek, dayIndex + 1)
                                }
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                  isCommitted ? "ring-2 ring-primary-500 ring-offset-1" : ""
                                } ${
                                  isSteps
                                    ? "bg-blue-500 text-white hover:bg-blue-600"
                                    : isCompleted
                                      ? "bg-green-500 text-white hover:bg-green-600"
                                      : "bg-gray-200 text-gray-400 hover:bg-gray-300"
                                }`}
                              >
                                {isSteps ? (
                                  <Activity size={16} />
                                ) : isCompleted ? (
                                  <CheckCircle size={16} />
                                ) : (
                                  <XCircle size={16} />
                                )}
                              </button>
                            </div>
                          </td>
                        );
                      })}

                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <div
                            className={`text-sm font-medium ${
                              weekStats.isComplete
                                ? "text-green-600"
                                : "text-gray-600"
                            }`}
                          >
                            {weekStats.completed}/{weekStats.required}
                          </div>
                          {weekStats.isComplete && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {planModalUser && (
        <WeeklyPlanModal
          isOpen={true}
          onClose={() => setPlanModalUserId(null)}
          user={planModalUser}
          week={selectedWeek}
          weekDates={weekDates}
          existingPlan={planModalExistingPlan}
          lockReason={planModalLockReason}
          onSave={async (days) => {
            await onUpdateWeeklyPlan({
              userId: planModalUser.id,
              week: selectedWeek,
              committedDays: days,
              createdBy: "admin",
            });
          }}
        />
      )}
    </div>
  );
};

export default Workout;
