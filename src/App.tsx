import React, { useState, useEffect } from "react";
import {
  User,
  Goal,
  WeeklyUpdate,
  WeeklyPlan,
  Proof,
  WorkoutDay,
  AdminSettings,
} from "./types";
import Header from "./components/Header";
import Workout from "./components/Workout";
import Dashboard from "./components/Dashboard";
import Goals from "./components/Goals";
import Admin from "./components/Admin";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider, useToast } from "./components/ToastContext";
import Toast from "./components/Toast";
import { generateMockData } from "./utils/mockData";
import { apiService } from "./services/api";
import { updateAllUsersConsistency } from "./utils/consistencyCalculator";
import { getCurrentWeek } from "./utils/dateUtils";

type ActiveView = "workout" | "goals" | "dashboard" | "admin";

function AppContent() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [weeklyUpdates, setWeeklyUpdates] = useState<WeeklyUpdate[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    challengeStartDate: "2026-01-19",
    challengeEndDate: "2026-07-31",
    currentWeek: 1,
    isActive: true,
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>(
    () => (localStorage.getItem("activeView") as ActiveView) ?? "workout"
  );

  useEffect(() => {
    localStorage.setItem("activeView", activeView);
  }, [activeView]);

  // Recalculate user consistency metrics based on workout data
  const recalculateUserConsistency = () => {
    setUsers((currentUsers) => {
      const currentWeek = getCurrentWeek();
      const goalData = goals.map((g) => ({
        userId: g.userId,
        isCompleted: g.isCompleted,
      }));

      const updatedUsers = updateAllUsersConsistency(
        currentUsers,
        workoutDays,
        goalData,
        currentWeek,
        weeklyPlans,
      );

      // Log changes and update database
      updatedUsers.forEach((updatedUser) => {
        const originalUser = currentUsers.find(
          (u: User) => u.id === updatedUser.id,
        );
        if (
          originalUser &&
          (originalUser.cleanWeeks !== updatedUser.cleanWeeks ||
            originalUser.missedWeeks !== updatedUser.missedWeeks ||
            originalUser.currentConsistencyLevel !==
              updatedUser.currentConsistencyLevel ||
            originalUser.totalPoints !== updatedUser.totalPoints ||
            originalUser.isActive !== updatedUser.isActive)
        ) {
          console.log(`🔄 Auto-updating consistency for ${updatedUser.name}:`, {
            cleanWeeks: `${originalUser.cleanWeeks} → ${updatedUser.cleanWeeks}`,
            missedWeeks: `${originalUser.missedWeeks} → ${updatedUser.missedWeeks}`,
            level: `${originalUser.currentConsistencyLevel} → ${updatedUser.currentConsistencyLevel}`,
            points: `${originalUser.totalPoints} → ${updatedUser.totalPoints}`,
            active: `${originalUser.isActive} → ${updatedUser.isActive}`,
          });

          // Update in database
          apiService.updateUser(updatedUser.id, updatedUser).catch((error) => {
            console.error("Error updating user in database:", error);
          });
        }
      });

      return updatedUsers;
    });
  };

  useEffect(() => {
    // Load data from SQLite database
    const loadData = async () => {
      try {
        console.log("🔍 Loading data from SQLite database...");

        // Test database connection first
        const isConnected = await apiService.testConnection();
        if (!isConnected) {
          console.error("❌ Cannot connect to database, using mock data");
          const mockData = generateMockData();
          setUsers(mockData.users);
          setGoals(mockData.goals);
          setWeeklyUpdates(mockData.weeklyUpdates);
          setProofs(mockData.proofs);
          setCurrentUser(mockData.users[0]);
          return;
        }

        // Load users from database
        const dbUsers = await apiService.getUsers();
        console.log("✅ Loaded users from database:", dbUsers);

        // Load workout data from database
        const dbWorkouts = await apiService.getAllWorkouts();
        console.log("✅ Loaded workouts from database:", dbWorkouts);

        // Load goals data from database
        const dbGoals = await apiService.getAllGoals();
        console.log("✅ Loaded goals from database:", dbGoals);

        // Load weekly plans from database
        const dbPlans = await apiService.getWeeklyPlans().catch((err) => {
          console.warn("Weekly plans unavailable (API not reachable):", err);
          return [] as WeeklyPlan[];
        });
        console.log("✅ Loaded weekly plans from database:", dbPlans);

        setUsers(dbUsers);
        setWorkoutDays(dbWorkouts);
        setGoals(dbGoals);
        setWeeklyPlans(dbPlans);
        setCurrentUser(dbUsers[0] || null);

        // Initialize other data (these will be implemented later)
        setWeeklyUpdates([]);
        setProofs([]);

        // Recalculate consistency metrics after loading data
        setTimeout(() => {
          const currentWeek = getCurrentWeek();
          const goalData = dbGoals.map((g) => ({
            userId: g.userId,
            isCompleted: g.isCompleted,
          }));
          const updatedUsers = updateAllUsersConsistency(
            dbUsers,
            dbWorkouts,
            goalData,
            currentWeek,
            dbPlans,
          );

          // Update users with recalculated metrics
          updatedUsers.forEach((updatedUser) => {
            const originalUser = dbUsers.find((u) => u.id === updatedUser.id);
            if (
              originalUser &&
              (originalUser.cleanWeeks !== updatedUser.cleanWeeks ||
                originalUser.missedWeeks !== updatedUser.missedWeeks ||
                originalUser.currentConsistencyLevel !==
                  updatedUser.currentConsistencyLevel ||
                originalUser.totalPoints !== updatedUser.totalPoints)
            ) {
              apiService.updateUser(updatedUser.id, updatedUser).then(() => {
                setUsers((prev) =>
                  prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
                );
              });
            }
          });
        }, 500);
      } catch (error) {
        console.error("❌ Error loading data from database:", error);
        // Fallback to mock data if database fails
        const mockData = generateMockData();
        setUsers(mockData.users);
        setGoals(mockData.goals);
        setWeeklyUpdates(mockData.weeklyUpdates);
        setProofs(mockData.proofs);
        setCurrentUser(mockData.users[0]);
      }
    };

    loadData();
  }, []);

  const updateUser = async (updatedUser: User) => {
    console.log("App.updateUser called with:", updatedUser);

    const existingUserIndex = users.findIndex((u) => u.id === updatedUser.id);
    console.log("Existing user index:", existingUserIndex);

    try {
      let savedUser: User;

      if (existingUserIndex >= 0) {
        // Update existing user
        console.log("Updating existing user in database");
        savedUser = await apiService.updateUser(updatedUser.id, updatedUser);
      } else {
        // Create new user (don't use the frontend-generated ID)
        console.log("Creating new user in database");
        const { id, ...userDataWithoutId } = updatedUser; // Remove the frontend ID
        savedUser = await apiService.createUser(userDataWithoutId);
      }

      // Update local state with the database-returned user (which has the correct ID)
      setUsers((prevUsers) => {
        if (existingUserIndex >= 0) {
          const newUsers = [...prevUsers];
          newUsers[existingUserIndex] = savedUser;
          return newUsers;
        } else {
          return [...prevUsers, savedUser];
        }
      });

      if (currentUser?.id === updatedUser.id) {
        setCurrentUser(savedUser);
      }

      console.log("✅ User saved successfully:", savedUser);
    } catch (error) {
      console.error("❌ Error saving user:", error);
      showToast(
        `Failed to save user: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    }
  };

  const addGoal = async (goal: Goal) => {
    try {
      console.log("➕ Creating goal in database:", goal);
      const savedGoal = await apiService.createGoal(goal);

      // Update local state
      setGoals((prevGoals) => [...prevGoals, savedGoal]);
      console.log("✅ Goal saved to database successfully");
    } catch (error) {
      console.error("❌ Error saving goal to database:", error);
      showToast(
        `Failed to save goal: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    }
  };

  const updateGoal = async (updatedGoal: Goal) => {
    try {
      console.log("✏️ Updating goal in database:", updatedGoal);
      const savedGoal = await apiService.updateGoal(
        updatedGoal.id,
        updatedGoal,
      );

      // Update local state
      setGoals((prevGoals) => {
        const newGoals = prevGoals.map((g) =>
          g.id === updatedGoal.id ? savedGoal : g,
        );

        // Trigger consistency recalculation if goal completion status changed
        if (
          updatedGoal.isCompleted !==
          prevGoals.find((g) => g.id === updatedGoal.id)?.isCompleted
        ) {
          setTimeout(() => recalculateUserConsistency(), 100);
        }

        return newGoals;
      });
      console.log("✅ Goal updated in database successfully");
    } catch (error) {
      console.error("❌ Error updating goal in database:", error);
      showToast(
        `Failed to update goal: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      console.log("🗑️ Deleting goal from database:", goalId);
      await apiService.deleteGoal(goalId);

      // Update local state
      setGoals((prevGoals) => prevGoals.filter((g) => g.id !== goalId));
      console.log("✅ Goal deleted from database successfully");
    } catch (error) {
      console.error("❌ Error deleting goal from database:", error);
      showToast(
        `Failed to delete goal: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    }
  };

  const updateWorkoutDay = async (workoutDay: WorkoutDay) => {
    try {
      console.log("💪 Saving workout to database:", workoutDay);

      // Save to database
      const savedWorkout = await apiService.saveWorkout(workoutDay);

      // Update local state
      setWorkoutDays((prev) => {
        const existing = prev.find(
          (w) =>
            w.userId === workoutDay.userId &&
            w.week === workoutDay.week &&
            w.dayOfWeek === workoutDay.dayOfWeek,
        );

        let newWorkoutDays;
        if (existing) {
          newWorkoutDays = prev.map((w) =>
            w.id === existing.id ? savedWorkout : w,
          );
        } else {
          newWorkoutDays = [...prev, savedWorkout];
        }

        // Trigger consistency recalculation after state update
        setTimeout(() => recalculateUserConsistency(), 100);

        return newWorkoutDays;
      });

      console.log("✅ Workout saved to database successfully");
    } catch (error) {
      console.error("❌ Error saving workout to database:", error);
      showToast("Failed to save workout data. Please try again.", "error");
    }
  };

  const updateWeeklyPlan = async (plan: {
    userId: string;
    week: number;
    committedDays: number[];
    createdBy?: 'user' | 'admin';
  }) => {
    try {
      const savedPlan = await apiService.saveWeeklyPlan(plan);
      setWeeklyPlans((prev) => {
        const existing = prev.find(
          (p) => p.userId === savedPlan.userId && p.week === savedPlan.week,
        );
        const next = existing
          ? prev.map((p) => (p.id === existing.id ? savedPlan : p))
          : [...prev, savedPlan];
        setTimeout(() => recalculateUserConsistency(), 100);
        return next;
      });
      showToast(
        `Plan saved for Week ${savedPlan.week} (${savedPlan.committedDays.length} days)`,
        "success",
      );
      return savedPlan;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Error saving weekly plan:", error);
      showToast(`Failed to save plan: ${msg}`, "error");
      throw error;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      console.log("🗑️ Deleting user from database:", userId);

      // Delete from database (this will cascade delete related data)
      await apiService.deleteUser(userId);

      // Update local state
      setUsers((prevUsers: User[]) =>
        prevUsers.filter((u: User) => u.id !== userId),
      );
      setGoals((prevGoals: Goal[]) =>
        prevGoals.filter((g: Goal) => g.userId !== userId),
      );
      setWeeklyUpdates((prevUpdates: WeeklyUpdate[]) =>
        prevUpdates.filter((w: WeeklyUpdate) => w.userId !== userId),
      );
      setProofs((prevProofs: Proof[]) =>
        prevProofs.filter((p: Proof) => p.userId !== userId),
      );
      setWorkoutDays((prevWorkouts: WorkoutDay[]) =>
        prevWorkouts.filter((w: WorkoutDay) => w.userId !== userId),
      );

      console.log("✅ User deleted from database successfully");
    } catch (error) {
      console.error("❌ Error deleting user from database:", error);
      showToast("Failed to delete user. Please try again.", "error");
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading FitBois 2.0...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activeView={activeView} onViewChange={setActiveView} />

      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8">
        <ErrorBoundary>
          {activeView === "workout" && (
            <Workout
              users={users}
              workoutDays={workoutDays}
              weeklyPlans={weeklyPlans}
              adminSettings={adminSettings}
              onUpdateWorkoutDay={updateWorkoutDay}
              onUpdateWeeklyPlan={updateWeeklyPlan}
            />
          )}

          {activeView === "goals" && (
            <Goals
              user={currentUser}
              users={users}
              goals={goals}
              onAddGoal={addGoal}
              onUpdateGoal={updateGoal}
              onDeleteGoal={deleteGoal}
            />
          )}

          {activeView === "dashboard" && (
            <Dashboard
              currentUser={currentUser}
              users={users}
              goals={goals}
              weeklyUpdates={weeklyUpdates}
              proofs={proofs}
              workoutDays={workoutDays}
            />
          )}

          {activeView === "admin" && (
            <Admin
              users={users}
              workoutDays={workoutDays}
              adminSettings={adminSettings}
              onUpdateUser={updateUser}
              onDeleteUser={deleteUser}
              onUpdateWorkoutDay={updateWorkoutDay}
              onRecalculateConsistency={recalculateUserConsistency}
            />
          )}
        </ErrorBoundary>
      </main>
      <Toast />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
