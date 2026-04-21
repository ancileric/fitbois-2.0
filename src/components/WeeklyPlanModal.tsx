import React, { useState, useEffect } from "react";
import { X, Lock, Calendar } from "lucide-react";
import { User, WeeklyPlan, getRequiredWorkouts } from "../types";
import { formatDayLabel } from "../utils/dateUtils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type PlanLockReason =
  | "past-week"
  | "monday-ended"
  | "workout-logged"
  | null;

interface WeeklyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  week: number;
  weekDates: Date[]; // length 7; weekDates[0] = Monday
  existingPlan: WeeklyPlan | null;
  lockReason: PlanLockReason;
  onSave: (committedDays: number[]) => Promise<void>;
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
}) => {
  const required = getRequiredWorkouts(user.currentConsistencyLevel);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

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
      case "monday-ended":
        return "Plans for the current week must be set by end of Monday (IST). Your plan is locked for this week.";
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
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Week {week} Plan — {user.name}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Level {user.currentConsistencyLevel} · Commit to at least{" "}
              {required} days
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {isLocked && (
          <div className="mt-3 mb-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <Lock size={14} className="mt-0.5 shrink-0" />
            <span>{lockMessage}</span>
          </div>
        )}

        {!isLocked && (
          <p className="text-sm text-gray-600 mb-4 mt-3">
            Pick the days you'll hit. Follow through on all of them and earn a{" "}
            <span className="font-semibold text-primary-600">
              +1 bonus point
            </span>{" "}
            on top of the usual clean-week point.
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
                    ? "bg-primary-500 border-primary-500 text-white"
                    : "bg-white border-gray-200 text-gray-700 hover:border-primary-300"
                } ${!canEdit ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <span className="font-semibold">{label}</span>
                <span
                  className={`mt-0.5 ${
                    isSelected ? "text-white/90" : "text-gray-400"
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

        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
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
            className="border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50"
          >
            {isLocked ? "Close" : "Cancel"}
          </button>
          {canEdit && (
            <button
              onClick={handleSubmit}
              disabled={!canSave || submitting}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
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
