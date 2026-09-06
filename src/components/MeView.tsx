import React from "react";
import { Goal, User, WorkoutDay } from "../types";
import MySeason from "./MySeason";
import GoalBoard from "./GoalBoard";

/**
 * Everything that is yours, on one page: the week you are logging, the money
 * you owe, and the goals you set. These were two tabs, which meant two places to
 * check the same season.
 */

interface MeViewProps {
  currentUser: User | null;
  users: User[];
  goals: Goal[];
  workoutDays: WorkoutDay[];
  onUpdateWorkoutDay: (day: WorkoutDay) => void;
  onAddGoal: (goal: Goal) => void;
  onUpdateGoal: (goal: Goal) => void;
  onDeleteGoal: (goalId: string) => void;
}

const MeView: React.FC<MeViewProps> = ({
  currentUser,
  users,
  goals,
  workoutDays,
  onUpdateWorkoutDay,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
}) => (
  <div className="divide-y divide-line">
    <MySeason
      currentUser={currentUser}
      workoutDays={workoutDays}
      onUpdateWorkoutDay={onUpdateWorkoutDay}
    />

    <div className="pt-10 mt-10">
      <GoalBoard
        currentUser={currentUser}
        user={currentUser}
        users={users}
        goals={goals}
        onAddGoal={onAddGoal}
        onUpdateGoal={onUpdateGoal}
        onDeleteGoal={onDeleteGoal}
      />
    </div>
  </div>
);

export default MeView;
