import React, { useState, useMemo } from "react";
import { User, WorkoutDay, AdminSettings } from "../types";
import {
  CheckCircle,
  XCircle,
  Users,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { getCurrentWeek, getDaysUntilStart } from "../utils/dateUtils";

interface WorkoutProps {
  users: User[];
  workoutDays: WorkoutDay[];
  adminSettings: AdminSettings;
  onUpdateWorkoutDay: (workoutDay: WorkoutDay) => void;
}

const Workout: React.FC<WorkoutProps> = ({
  users,
  workoutDays,
  adminSettings,
  onUpdateWorkoutDay,
}) => {
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

  // Toggle workout completion
  const toggleWorkout = (userId: string, week: number, dayOfWeek: number) => {
    const existing = getWorkoutDay(userId, week, dayOfWeek);
    // Create a new Date object to avoid mutating startDate
    const date = new Date(startDate.getTime());
    date.setDate(date.getDate() + (week - 1) * 7 + (dayOfWeek - 1));

    const workoutDay: WorkoutDay = {
      id:
        existing?.id || `workout-${userId}-${week}-${dayOfWeek}-${Date.now()}`,
      userId,
      week,
      dayOfWeek,
      date: date.toISOString().split("T")[0],
      isCompleted: existing ? !existing.isCompleted : true,
      markedBy: "admin",
      timestamp: new Date().toISOString(),
      workoutType: existing?.workoutType,
      notes: existing?.notes,
    };

    onUpdateWorkoutDay(workoutDay);
  };

  // Calculate weekly stats for each user using database data
  const getUserWeekStats = (userId: string, week: number) => {
    const user = users.find((u) => u.id === userId);
    const requiredDays = user?.currentConsistencyLevel || 5;

    // Get completed workouts from database for this user and week
    const completedWorkouts = workoutDays.filter(
      (w) => w.userId === userId && w.week === week && w.isCompleted,
    );

    const completedDays = completedWorkouts.length;

    return {
      completed: completedDays,
      required: requiredDays,
      isComplete: completedDays >= requiredDays,
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
        // Get user's required workouts per week based on their consistency level
        const requiredWorkouts = user.currentConsistencyLevel;

        // Get actual completed workouts for this user and week from database
        const userWeekWorkouts = workoutDays.filter(
          (w) => w.userId === user.id && w.week === week && w.isCompleted,
        );

        const completedWorkouts = userWeekWorkouts.length;

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
  }, [users, workoutDays, weeks]);

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

                  {/* Days Row */}
                  <div className="flex justify-between items-center">
                    {daysOfWeek.map((day, dayIndex) => {
                      const workoutDay = getWorkoutDay(
                        user.id,
                        selectedWeek,
                        dayIndex + 1,
                      );
                      const isCompleted = workoutDay?.isCompleted || false;

                      return (
                        <div key={day} className="flex flex-col items-center">
                          <span className="text-xs text-gray-500 mb-1">
                            {day.charAt(0)}
                          </span>
                          <button
                            onClick={() =>
                              toggleWorkout(user.id, selectedWeek, dayIndex + 1)
                            }
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                              isCompleted
                                ? "bg-green-500 text-white"
                                : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            {isCompleted ? (
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
                {daysOfWeek.map((day) => (
                  <th
                    key={day}
                    className="text-center py-3 px-3 font-medium text-gray-900 w-16"
                  >
                    {day}
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
                          <div>
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

                        return (
                          <td key={day} className="py-4 px-3 text-center">
                            <div className="flex justify-center">
                              <button
                                onClick={() =>
                                  toggleWorkout(
                                    user.id,
                                    selectedWeek,
                                    dayIndex + 1,
                                  )
                                }
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                  isCompleted
                                    ? "bg-green-500 text-white hover:bg-green-600"
                                    : "bg-gray-200 text-gray-400 hover:bg-gray-300"
                                }`}
                              >
                                {isCompleted ? (
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
    </div>
  );
};

export default Workout;
