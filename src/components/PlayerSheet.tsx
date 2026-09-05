import React, { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Goal } from "../types";
import { apiFetch, latestGoalReadings } from "../services/http";

/**
 * One player's season, opened from the group list.
 *
 * Read-only by design: you can see anyone's record, but Rule 04 and Rule 05 keep
 * the editing to the person it belongs to.
 */


interface Season {
  userId: string;
  name: string;
  currentWeek: number;
  fineIfMissed: number;
  standing: "active" | "suspended" | "out";
  cleanWeeks: number;
  missedWeeks: number;
  cleanStreak: number;
  tokensLeft: number;
  billed: number;
  paid: number;
  outstanding: number;
  potEligible: boolean;
  weeks: { week: number; outcome: "clean" | "missed" | "skipped"; workouts: number; fine: number }[];
  currentWeekProgress: { week: number; workouts: number; needed: number };
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const OUTCOME_STYLE = {
  clean: "bg-clean-500",
  missed: "bg-owed-500",
  skipped: "bg-skip-500",
} as const;

const PlayerSheet: React.FC<{ userId: string; onClose: () => void }> = ({ userId, onClose }) => {
  const [season, setSeason] = useState<Season | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const [seasonRes, goalsRes] = await Promise.all([
      apiFetch(`/season/${userId}`),
      apiFetch(`/goals/user/${userId}`),
    ]);
    const seasonData = seasonRes.ok ? await seasonRes.json() : null;
    const goalData: Goal[] = goalsRes.ok ? await goalsRes.json() : [];
    setSeason(seasonData);
    setGoals(goalData);

    setProgress(await latestGoalReadings());
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Escape closes, as it should for anything that covers the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fractionFor = (goal: Goal): number | null => {
    const current = progress[goal.id];
    if (goal.baselineValue == null || goal.targetValue == null || current == null) return null;
    if (goal.targetValue === goal.baselineValue) return current >= goal.targetValue ? 1 : 0;
    return Math.max(0, Math.min(1, (current - goal.baselineValue) / (goal.targetValue - goal.baselineValue)));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={season ? `${season.name}'s season` : "Player"}
      onClick={onClose}
    >
      <div
        className="bg-paper w-full sm:max-w-xl max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {!season ? (
          <div className="h-40 rounded-xl bg-line-soft animate-pulse" />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="display text-3xl">{season.name}</h2>
                <p className="text-sm text-ink-muted mt-0.5">
                  {season.standing === "out"
                    ? "Out for the season"
                    : `${rupees(season.fineIfMissed)} a missed week · ${season.tokensLeft} skips left`}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="min-w-[44px] min-h-[44px] grid place-items-center rounded-xl text-ink-muted
                           hover:text-ink cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <dl className="grid grid-cols-4 border-y border-line mt-4 sm:divide-x divide-line">
              {[
                ["Clean", String(season.cleanWeeks), "text-clean-600"],
                ["Fined", String(season.missedWeeks), "text-owed-600"],
                ["Paid", rupees(season.paid), "text-ink"],
                ["Owed", rupees(season.outstanding), season.outstanding ? "text-owed-600" : "text-clean-600"],
              ].map(([label, value, tone]) => (
                <div key={label} className="py-3 pr-3 sm:px-3 sm:first:pl-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{label}</dt>
                  <dd className={`display text-2xl tnum mt-0.5 ${tone}`}>{value}</dd>
                </div>
              ))}
            </dl>

            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted mt-5 mb-2">
              Week by week
            </p>
            <div className="flex gap-1">
              {season.weeks.map((w) => (
                <div
                  key={w.week}
                  title={`Week ${w.week}: ${w.workouts} workouts${w.fine ? ` — ${rupees(w.fine)}` : ""}`}
                  className={`h-7 flex-1 rounded-md ${OUTCOME_STYLE[w.outcome]}`}
                />
              ))}
              <div className="h-7 flex-1 rounded-md border-2 border-dashed border-ink-faint" />
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted mt-6 mb-2">
              Goals
            </p>
            <ul className="divide-y divide-line border-t border-line">
              {goals.map((goal) => {
                const fraction = fractionFor(goal);
                return (
                  <li key={goal.id} className="py-3">
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-paper-sunk text-ink-muted tnum shrink-0">
                        {goal.points} PT{goal.points > 1 ? "S" : ""}
                      </span>
                      <p className={`text-sm flex-1 ${goal.isCompleted ? "text-ink-muted line-through" : "text-ink"}`}>
                        {goal.description}
                      </p>
                    </div>
                    {fraction !== null ? (
                      <div className="mt-2 pl-14">
                        <div className="h-1.5 rounded-full bg-line overflow-hidden">
                          <div
                            className={`h-full rounded-full ${fraction === 1 ? "bg-clean-500" : "bg-ink"}`}
                            style={{ width: `${fraction * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-ink-muted mt-1 tnum">
                          {progress[goal.id]} / {goal.targetValue}
                          {goal.unit ? ` ${goal.unit}` : ""} · {Math.round(fraction * 100)}%
                        </p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
              {!goals.length ? <li className="py-4 text-sm text-ink-muted">No goals set yet.</li> : null}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerSheet;
