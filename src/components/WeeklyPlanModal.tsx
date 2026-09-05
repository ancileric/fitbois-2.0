import React, { useState, useEffect } from "react";
import { X, Lock, Calendar } from "lucide-react";
import { User, WeeklyPlan, WORKOUTS_PER_WEEK } from "../types";
import { formatDayLabel } from "../utils/dateUtils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type PlanLockReason =
  | "past-week"
  | "deadline-passed"
  | "workout-logged"
  | null;

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface WeeklyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  week: number;
  weekDates: Date[]; // length 7; weekDates[0] = Monday
  existingPlan: WeeklyPlan | null;
  lockReason: PlanLockReason;
  onSave: (committedDays: number[]) => Promise<void>;
  /** Rule 06: one swap a week, applied before the day starts. */
  onSwap?: (from: number, to: number) => Promise<string | null>;
  swapsUsed?: number;
}

const WeeklyPlanModal: React.FC<WeeklyPlanModalProps> = ({
  isOpen,
  onClose,
  user,
  week,
  weekDates,
  existingPlan,
  lockReason,
  onSave,
  onSwap,
  swapsUsed = 0,
}) => {
  const required = WORKOUTS_PER_WEEK;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [swapNotice, setSwapNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set(existingPlan?.committedDays || []));
      setSubmitting(false);
    }
  }, [isOpen, existingPlan]);

  if (!isOpen) return null;

  const isLocked = lockReason !== null;
  const canEdit = !isLocked;

  const toggleDay = (day: number) => {
    if (!canEdit) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting || !canEdit) return;
    const days = Array.from(selected).sort((a, b) => a - b);
    if (days.length < required) return;
    setSubmitting(true);
    try {
      await onSave(days);
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  const lockMessage = (() => {
    switch (lockReason) {
      case "past-week":
        return "This week has already ended — plans can only be set for the current or future weeks.";
      case "deadline-passed":
        return "Plans for the current week had to be set by Sunday 23:59 IST of the prior week. Your plan is locked.";
      case "workout-logged":
        return "A workout has already been logged for this week, so the plan is locked.";
      default:
        return null;
    }
  })();

  const selectedCount = selected.size;
  const canSave = canEdit && selectedCount >= required;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-paper-card rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Week {week} Plan — {user.name}
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Commit to at least{" "}
              {required} days
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink-muted"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {isLocked && (
          <div className="mt-3 mb-3 flex items-start gap-2 bg-skip-50 border border-skip-100 rounded-lg px-3 py-2 text-xs text-skip-700">
            <Lock size={14} className="mt-0.5 shrink-0" />
            <span>{lockMessage}</span>
          </div>
        )}


        {isLocked && onSwap && existingPlan ? (
          <div className="mt-3 border-t border-line-soft pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
              Swap a session {swapsUsed >= 1 ? "— spent for this week" : "— one a week"}
            </p>
            {swapsUsed >= 1 ? (
              <p className="text-sm text-ink-muted">You've already swapped this week.</p>
            ) : (
              <>
                <p className="text-sm text-ink-muted mb-2">
                  {swapFrom
                    ? `Moving ${DAY_NAMES[swapFrom - 1]} to…`
                    : "Pick the committed day you're moving."}
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
                    const committed = existingPlan.committedDays.includes(dow);
                    const pickable = swapFrom ? !committed : committed;
                    return (
                      <button
                        key={dow}
                        disabled={!pickable || submitting}
                        onClick={async () => {
                          if (!swapFrom) {
                            setSwapFrom(dow);
                            setSwapNotice(null);
                            return;
                          }
                          setSubmitting(true);
                          const error = await onSwap(swapFrom, dow);
                          setSubmitting(false);
                          setSwapFrom(null);
                          setSwapNotice(error ?? `Moved to ${DAY_NAMES[dow - 1]}.`);
                        }}
                        className={`w-10 h-9 rounded-lg text-xs font-semibold border ${
                          swapFrom === dow
                            ? "border-primary-500 bg-primary-50 text-primary-700"
                            : "border-line text-ink"
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        {DAY_NAMES[dow - 1].slice(0, 2)}
                      </button>
                    );
                  })}
                </div>
                {swapNotice ? <p className="text-sm text-ink mt-2">{swapNotice}</p> : null}
              </>
            )}
          </div>
        ) : null}

        {!isLocked && (
          <p className="text-sm text-ink-muted mb-4 mt-3">
            Pick the days you'll hit. Hit every committed day to earn{" "}
            <span className="font-semibold text-primary-600">+1 point</span>{" "}
            for the week. Miss any of them and you{" "}
            <span className="font-semibold text-owed-600">lose 1 point</span>.
          </p>
        )}

        {/* Day chips */}
        <div className="grid grid-cols-7 gap-1.5 mt-2">
          {DAY_LABELS.map((label, idx) => {
            const day = idx + 1;
            const isSelected = selected.has(day);
            return (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                disabled={!canEdit}
                className={`flex flex-col items-center py-2 rounded-lg border text-xs transition-colors ${
                  isSelected
                    ? "bg-primary-500 border-primary-500 text-paper"
                    : "bg-paper-card border-line text-ink hover:border-primary-300"
                } ${!canEdit ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <span className="font-semibold">{label}</span>
                <span
                  className={`mt-0.5 ${
                    isSelected ? "text-paper/90" : "text-ink-faint"
                  }`}
                >
                  {weekDates[idx]
                    ? formatDayLabel(weekDates[idx]).split(" ")[1]
                    : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
          <Calendar size={14} />
          <span>
            {selectedCount} / {required}+ days selected
            {selectedCount > 0 && selectedCount < required && (
              <span className="text-amber-600 ml-1">
                · pick {required - selectedCount} more
              </span>
            )}
          </span>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="border border-line text-ink rounded-lg px-4 py-2 text-sm hover:bg-paper-sunk"
          >
            {isLocked ? "Close" : "Cancel"}
          </button>
          {canEdit && (
            <button
              onClick={handleSubmit}
              disabled={!canSave || submitting}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-paper ${
                canSave && !submitting
                  ? "bg-primary-500 hover:bg-primary-600"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {submitting
                ? "Saving…"
                : existingPlan
                  ? "Update plan"
                  : "Lock it in"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeeklyPlanModal;
