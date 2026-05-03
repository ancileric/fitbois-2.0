import React, { useState, useMemo } from "react";
import { User, Goal, WorkoutDay, GOAL_CATEGORIES } from "../types";
import { ChevronDown, ChevronUp } from "lucide-react";

interface MilestonesFeedProps {
  users: User[];
  goals: Goal[];
  workoutDays: WorkoutDay[];
  currentWeek: number;
}

interface Milestone {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  icon: string;
  description: string;
  date: string;
  type: "goal" | "consistency" | "workout-count";
}

const WORKOUT_THRESHOLDS = [100, 75, 50, 25];

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Upcoming";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 14) return "1w ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 60) return "1mo ago";
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function getCategoryIcon(category: string): string {
  return (
    GOAL_CATEGORIES.find((c) => c.id === category)?.icon ?? "🎯"
  );
}

const MilestonesFeed: React.FC<MilestonesFeedProps> = ({
  users,
  goals,
  workoutDays,
  currentWeek,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const milestones = useMemo(() => {
    const result: Milestone[] = [];

    // 1. Goal completions
    goals
      .filter((g) => g.isCompleted && g.completedDate)
      .forEach((goal) => {
        const user = userMap.get(goal.userId);
        if (!user) return;
        result.push({
          id: `goal-${goal.id}`,
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar,
          icon: getCategoryIcon(goal.category),
          description: `Completed: ${goal.description}`,
          date: goal.completedDate!,
          type: "goal",
        });
      });

    // 2. Consistency milestones (reached level 4 or 3 from starting at 5)
    users.forEach((user) => {
      if (user.currentConsistencyLevel <= 4) {
        const levelLabel =
          user.currentConsistencyLevel === 3 ? "Level 3" : "Level 4";

        // Approximate the date: use the start of the week where enough clean weeks
        // accumulated. Fall back to the most recent workout date for this user.
        const userWorkouts = workoutDays
          .filter((w) => w.userId === user.id && w.isCompleted)
          .sort((a, b) => b.date.localeCompare(a.date));
        const approxDate =
          userWorkouts[0]?.date ?? new Date().toISOString().split("T")[0];

        result.push({
          id: `level-${user.id}-${user.currentConsistencyLevel}`,
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar,
          icon: "🏆",
          description: `Reached ${levelLabel}!`,
          date: approxDate,
          type: "consistency",
        });

        // If at level 3, they also passed through level 4
        if (user.currentConsistencyLevel === 3) {
          const midWorkouts = workoutDays
            .filter((w) => w.userId === user.id && w.isCompleted)
            .sort((a, b) => a.date.localeCompare(b.date));
          const midpointIdx = Math.floor(midWorkouts.length * 0.6);
          const midDate =
            midWorkouts[midpointIdx]?.date ??
            new Date().toISOString().split("T")[0];

          result.push({
            id: `level-${user.id}-4`,
            userId: user.id,
            userName: user.name,
            userAvatar: user.avatar,
            icon: "⬆️",
            description: "Reached Level 4!",
            date: midDate,
            type: "consistency",
          });
        }
      }
    });

    // 3. Workout count milestones (25, 50, 75, 100)
    users.forEach((user) => {
      const sorted = workoutDays
        .filter((w) => w.userId === user.id && w.isCompleted)
        .sort((a, b) => a.date.localeCompare(b.date));

      WORKOUT_THRESHOLDS.forEach((threshold) => {
        if (sorted.length >= threshold) {
          const milestoneWorkout = sorted[threshold - 1];
          result.push({
            id: `workouts-${user.id}-${threshold}`,
            userId: user.id,
            userName: user.name,
            userAvatar: user.avatar,
            icon: threshold >= 100 ? "💯" : "🔥",
            description: `Hit ${threshold} workouts!`,
            date: milestoneWorkout.date,
            type: "workout-count",
          });
        }
      });
    });

    result.sort((a, b) => b.date.localeCompare(a.date));
    return result.slice(0, 10);
  }, [users, goals, workoutDays, userMap]);

  const typeBadge: Record<Milestone["type"], { label: string; cls: string }> = {
    goal: { label: "Goal", cls: "bg-blue-100 text-blue-700" },
    consistency: { label: "Level Up", cls: "bg-purple-100 text-purple-700" },
    "workout-count": { label: "Streak", cls: "bg-orange-100 text-orange-700" },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold text-gray-900">Milestones</h2>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4">
          {milestones.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              No milestones yet — keep grinding!
            </p>
          ) : (
            <div className="space-y-3">
              {milestones.map((m) => {
                const badge = typeBadge[m.type];
                return (
                  <div
                    key={m.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                  >
                    <div className="text-xl flex-shrink-0 leading-none pt-0.5">
                      {m.icon}
                    </div>
                    <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">
                      {m.userAvatar || m.userName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">{m.userName}</span>{" "}
                        <span className="text-gray-600">{m.description}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatRelativeDate(m.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MilestonesFeed;
