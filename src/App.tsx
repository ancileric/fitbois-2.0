import React, { useState, useEffect, useCallback, useRef } from "react";
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
import OfflineBanner from "./components/OfflineBanner";
import { ToastProvider, useToast } from "./components/ToastContext";
import Toast from "./components/Toast";
import { apiService } from "./services/api";
import { updateAllUsersConsistency } from "./utils/consistencyCalculator";
import { getCurrentWeek } from "./utils/dateUtils";

type ActiveView = "workout" | "goals" | "dashboard" | "admin";

const SNAPSHOT_KEY = "fitbois:snapshot";
const SNAPSHOT_VERSION = 1;
const RETRY_BACKOFF_MS = [5000, 10000, 20000, 30000];

interface Snapshot {
  version: number;
  savedAt: number;
  users: User[];
  workoutDays: WorkoutDay[];
  goals: Goal[];
  weeklyPlans: WeeklyPlan[];
}

const readSnapshot = (): Snapshot | null => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    if (parsed.version !== SNAPSHOT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeSnapshot = (snap: Omit<Snapshot, "version" | "savedAt">): void => {
  try {
    const payload: Snapshot = {
      version: SNAPSHOT_VERSION,
      savedAt: Date.now(),
      ...snap,
    };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or localStorage disabled — non-fatal.
  }
};

const userConsistencyEqual = (a: User, b: User): boolean =>
  a.cleanWeeks === b.cleanWeeks &&
  a.missedWeeks === b.missedWeeks &&
  a.currentConsistencyLevel === b.currentConsistencyLevel &&
  a.totalPoints === b.totalPoints &&
  a.isActive === b.isActive;

function AppContent() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [weeklyUpdates, setWeeklyUpdates] = useState<WeeklyUpdate[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [adminSettings] = useState<AdminSettings>({
    challengeStartDate: "2026-01-19",
    challengeEndDate: "2026-07-31",
    currentWeek: 1,
    isActive: true,
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>(
    () => (localStorage.getItem("activeView") as ActiveView) ?? "workout"
  );
  const [isOffline, setIsOffline] = useState(false);
  const [snapshotSavedAt, setSnapshotSavedAt] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);

  useEffect(() => {
    localStorage.setItem("activeView", activeView);
  }, [activeView]);

  const recalculateUserConsistency = useCallback(() => {
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

      if (!isOffline) {
        updatedUsers
          .filter((u) => {
            const original = currentUsers.find((o) => o.id === u.id);
            return original && !userConsistencyEqual(original, u);
          })
          .forEach((u) => {
            apiService.updateUser(u.id, u).catch((error) => {
              console.error("Error updating user in database:", error);
            });
          });
      }

      return updatedUsers;
    });
  }, [goals, workoutDays, weeklyPlans, isOffline]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const loadData = useCallback(async (): Promise<boolean> => {
    try {
      const isConnected = await apiService.testConnection();
      if (!isConnected) throw new Error("API unreachable");

      const [dbUsers, dbWorkouts, dbGoals, dbPlans] = await Promise.all([
        apiService.getUsers(),
        apiService.getAllWorkouts(),
        apiService.getAllGoals(),
        apiService.getWeeklyPlans().catch(() => [] as WeeklyPlan[]),
      ]);

      const currentWeek = getCurrentWeek();
      const goalData = dbGoals.map((g) => ({
        userId: g.userId,
        isCompleted: g.isCompleted,
      }));
      const recalculated = updateAllUsersConsistency(
        dbUsers,
        dbWorkouts,
        goalData,
        currentWeek,
        dbPlans,
      );

      const drifted = recalculated.filter((u) => {
        const original = dbUsers.find((o) => o.id === u.id);
        return original && !userConsistencyEqual(original, u);
      });

      setUsers(recalculated);
      setWorkoutDays(dbWorkouts);
      setGoals(dbGoals);
      setWeeklyPlans(dbPlans);
      setCurrentUser((prev) => {
        if (prev) {
          const match = recalculated.find((u) => u.id === prev.id);
          if (match) return match;
        }
        return recalculated[0] || null;
      });
      setWeeklyUpdates([]);
      setProofs([]);

      writeSnapshot({
        users: recalculated,
        workoutDays: dbWorkouts,
        goals: dbGoals,
        weeklyPlans: dbPlans,
      });
      setSnapshotSavedAt(Date.now());
      setIsOffline(false);
      setLoadFailed(false);
      retryAttemptRef.current = 0;

      // Persist recomputed consistency for any users that drifted from DB.
      drifted.forEach((u) => {
        apiService.updateUser(u.id, u).catch((error) => {
          console.error("Error syncing consistency to database:", error);
        });
      });

      return true;
    } catch (error) {
      console.error("Error loading data from database:", error);
      return false;
    }
  }, []);

  const scheduleRetry = useCallback(() => {
    clearRetryTimer();
    const delay =
      RETRY_BACKOFF_MS[Math.min(retryAttemptRef.current, RETRY_BACKOFF_MS.length - 1)];
    retryAttemptRef.current += 1;
    retryTimeoutRef.current = setTimeout(async () => {
      const ok = await loadData();
      if (!ok) scheduleRetry();
    }, delay);
  }, [loadData, clearRetryTimer]);

  const manualRetry = useCallback(async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    clearRetryTimer();
    const ok = await loadData();
    setIsRetrying(false);
    if (!ok) {
      retryAttemptRef.current = 0;
      scheduleRetry();
    }
  }, [isRetrying, clearRetryTimer, loadData, scheduleRetry]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ok = await loadData();
      if (cancelled) return;
      if (ok) return;

      // API failed — hydrate from snapshot if available.
      const snap = readSnapshot();
      if (snap) {
        setUsers(snap.users);
        setWorkoutDays(snap.workoutDays);
        setGoals(snap.goals);
        setWeeklyPlans(snap.weeklyPlans);
        setCurrentUser(snap.users[0] || null);
        setWeeklyUpdates([]);
        setProofs([]);
        setSnapshotSavedAt(snap.savedAt);
        setIsOffline(true);
        scheduleRetry();
      } else {
        setLoadFailed(true);
        scheduleRetry();
      }
    })();

    return () => {
      cancelled = true;
      clearRetryTimer();
    };
  }, [loadData, scheduleRetry, clearRetryTimer]);

  const blockIfOffline = (): boolean => {
    if (isOffline) {
      showToast("Offline — changes can't be saved yet.", "error");
      return true;
    }
    return false;
  };

  const updateUser = async (updatedUser: User) => {
    if (blockIfOffline()) return;
    const existingUserIndex = users.findIndex((u) => u.id === updatedUser.id);

    try {
      let savedUser: User;

      if (existingUserIndex >= 0) {
        savedUser = await apiService.updateUser(updatedUser.id, updatedUser);
      } else {
        const { id, ...userDataWithoutId } = updatedUser;
        savedUser = await apiService.createUser(userDataWithoutId);
      }

      setUsers((prevUsers) => {
        if (existingUserIndex >= 0) {
          const newUsers = [...prevUsers];
          newUsers[existingUserIndex] = savedUser;
          return newUsers;
        }
        return [...prevUsers, savedUser];
      });

      if (currentUser?.id === updatedUser.id) {
        setCurrentUser(savedUser);
      }
    } catch (error) {
      console.error("Error saving user:", error);
      showToast(
        `Failed to save user: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    }
  };

  const addGoal = async (goal: Goal) => {
    if (blockIfOffline()) return;
    try {
      const savedGoal = await apiService.createGoal(goal);
      setGoals((prevGoals) => [...prevGoals, savedGoal]);
    } catch (error) {
      console.error("Error saving goal to database:", error);
      showToast(
        `Failed to save goal: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    }
  };

  const updateGoal = async (updatedGoal: Goal) => {
    if (blockIfOffline()) return;
    try {
      const savedGoal = await apiService.updateGoal(
        updatedGoal.id,
        updatedGoal,
      );

      let completionChanged = false;
      setGoals((prevGoals) => {
        const prior = prevGoals.find((g) => g.id === updatedGoal.id);
        completionChanged = prior?.isCompleted !== updatedGoal.isCompleted;
        return prevGoals.map((g) => (g.id === updatedGoal.id ? savedGoal : g));
      });

      if (completionChanged) recalculateUserConsistency();
    } catch (error) {
      console.error("Error updating goal in database:", error);
      showToast(
        `Failed to update goal: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (blockIfOffline()) return;
    try {
      await apiService.deleteGoal(goalId);
      setGoals((prevGoals) => prevGoals.filter((g) => g.id !== goalId));
    } catch (error) {
      console.error("Error deleting goal from database:", error);
      showToast(
        `Failed to delete goal: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    }
  };

  const updateWorkoutDay = async (workoutDay: WorkoutDay) => {
    if (blockIfOffline()) return;
    try {
      const savedWorkout = await apiService.saveWorkout(workoutDay);

      setWorkoutDays((prev) => {
        const existing = prev.find(
          (w) =>
            w.userId === workoutDay.userId &&
            w.week === workoutDay.week &&
            w.dayOfWeek === workoutDay.dayOfWeek,
        );

        if (existing) {
          return prev.map((w) => (w.id === existing.id ? savedWorkout : w));
        }
        return [...prev, savedWorkout];
      });

      recalculateUserConsistency();
    } catch (error) {
      console.error("Error saving workout to database:", error);
      showToast("Failed to save workout data. Please try again.", "error");
    }
  };

  const updateWeeklyPlan = async (plan: {
    userId: string;
    week: number;
    committedDays: number[];
    createdBy?: 'user' | 'admin';
  }) => {
    if (isOffline) {
      showToast("Offline — changes can't be saved yet.", "error");
      throw new Error("Offline");
    }
    try {
      const savedPlan = await apiService.saveWeeklyPlan(plan);
      setWeeklyPlans((prev) => {
        const existing = prev.find(
          (p) => p.userId === savedPlan.userId && p.week === savedPlan.week,
        );
        return existing
          ? prev.map((p) => (p.id === existing.id ? savedPlan : p))
          : [...prev, savedPlan];
      });
      recalculateUserConsistency();
      showToast(
        `Plan saved for Week ${savedPlan.week} (${savedPlan.committedDays.length} days)`,
        "success",
      );
      return savedPlan;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Error saving weekly plan:", error);
      showToast(`Failed to save plan: ${msg}`, "error");
      throw error;
    }
  };

  const deleteUser = async (userId: string) => {
    if (blockIfOffline()) return;
    try {
      await apiService.deleteUser(userId);

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
    } catch (error) {
      console.error("Error deleting user from database:", error);
      showToast("Failed to delete user. Please try again.", "error");
    }
  };

  if (loadFailed && !currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Can't reach FitBois
          </h1>
          <p className="text-gray-600 mb-6">
            We couldn't load your data and no offline copy is available on this
            device. Check your connection and try again.
          </p>
          <button
            onClick={manualRetry}
            disabled={isRetrying}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {isRetrying ? "Retrying…" : "Retry"}
          </button>
        </div>
      </div>
    );
  }

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
      {isOffline && (
        <OfflineBanner
          savedAt={snapshotSavedAt}
          onRetry={manualRetry}
          isRetrying={isRetrying}
        />
      )}
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
