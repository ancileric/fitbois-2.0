import React, { useMemo } from 'react';
import { User, Goal, WorkoutDay } from '../types';

interface WeeklyRecapProps {
  users: User[];
  goals: Goal[];
  workoutDays: WorkoutDay[];
  currentWeek: number;
}

const WeeklyRecap: React.FC<WeeklyRecapProps> = ({
  users,
  goals,
  workoutDays,
  currentWeek,
}) => {
  const stats = useMemo(() => {
    const thisWeekWorkouts = workoutDays.filter(
      (w) => w.week === currentWeek && w.isCompleted,
    );

    const activeLoggedUsers = new Set(
      thisWeekWorkouts.map((w) => w.userId),
    ).size;

    const totalWorkouts = thisWeekWorkouts.length;

    // Goals completed within the last 7 days (approximation for "this week")
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString().split('T')[0];

    const goalsThisWeek = goals.filter(
      (g) => g.isCompleted && g.completedDate && g.completedDate >= cutoff,
    ).length;

    const usersAtRisk = users.filter(
      (u) =>
        u.isActive &&
        u.currentConsistencyLevel === 5 &&
        u.missedWeeks >= 1,
    ).length;

    return { activeLoggedUsers, totalWorkouts, goalsThisWeek, usersAtRisk };
  }, [users, goals, workoutDays, currentWeek]);

  const items = [
    {
      label: 'Logged In',
      value: stats.activeLoggedUsers,
      color: 'text-green-600',
    },
    {
      label: 'Workouts',
      value: stats.totalWorkouts,
      color: 'text-blue-600',
    },
    {
      label: 'Goals Done',
      value: stats.goalsThisWeek,
      color: 'text-amber-600',
    },
    {
      label: 'At Risk',
      value: stats.usersAtRisk,
      color: 'text-red-600',
    },
  ];

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Week {currentWeek} Recap
      </h3>
      <div className="grid grid-cols-4 gap-3 text-center">
        {items.map((item) => (
          <div key={item.label}>
            <div className={`text-xl md:text-2xl font-bold ${item.color}`}>
              {item.value}
            </div>
            <div className="text-[10px] md:text-xs text-gray-500 mt-0.5">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyRecap;
