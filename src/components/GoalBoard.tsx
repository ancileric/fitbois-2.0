import React, { useEffect, useMemo, useState } from "react";
import { Check, Lock, Plus, TrendingUp, Trash2 } from "lucide-react";
import { Goal, User } from "../types";
import { goalEligibilityError, goalProgressFraction } from "../utils/seasonEngine";
import { apiFetch, goalReadings, Reading } from "../services/http";

// PlayerSheet reads the board's parts from here, so the fetcher and its row
// type stay importable from this module even though they live in services.
export type { Reading };
export { goalReadings };

/**
 * A player's goals: what they are aiming at, and how far along they are.
 *
 * Goals carry no weight and cost nothing — they are here to motivate the
 * player who set them, so there is no budget and no limit on how many.
 */

interface GoalBoardProps {
  /** The player using the app — only they can change their own goals. */
  currentUser: User | null;
  user: User | null;
  users: User[];
  goals: Goal[];
  onAddGoal: (goal: Goal) => void;
  onUpdateGoal: (goal: Goal) => void;
  onDeleteGoal: (goalId: string) => void;
}

/** Ties the "why this goal won't take" message to the fields it is about. */
const ELIGIBILITY_ID = "goal-eligibility";

/** 47.8 stays 47.8; 48.0 reads as 48. */
const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

const stamp = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" });

/**
 * The journey from baseline to target, one segment per logged reading.
 *
 * Positions are by value, not by count — a reading that jumped halfway sits
 * halfway — so the gaps between the notches *are* the size of each move. The
 * newest is the solid, larger one; a reading that went backwards is drawn in
 * `owed` from where it fell back to.
 */
export const GoalTrack: React.FC<{ goal: Goal; readings: Reading[] }> = ({ goal, readings }) => {
  const base = goal.baselineValue;
  const target = goal.targetValue;
  if (base == null || target == null) return null;

  const unit = goal.unit ? ` ${goal.unit}` : "";
  const at = (v: number) => (goalProgressFraction(base, target, v) ?? 0) * 100;

  const steps = readings.map((r, i) => {
    const previous = i === 0 ? base : readings[i - 1].value;
    return {
      r,
      from: at(previous),
      to: at(r.value),
      move: r.value - previous,
      last: i === readings.length - 1,
    };
  });

  const now = steps.length ? steps[steps.length - 1].to : 0;
  const done = goal.isCompleted || now >= 100;
  const newest = readings.length ? readings[readings.length - 1].value : null;

  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-2 text-[11px] tnum text-ink-muted">
        <span>
          {num(base)}
          {unit} start
        </span>
        <span>
          {num(target)}
          {unit} target
        </span>
      </div>

      <div
        className="relative h-11"
        role="meter"
        aria-valuenow={Math.round(now)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${goal.description} progress`}
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-line" />

        {steps.map(({ r, from, to, move, last }, i) => {
          const lo = Math.min(from, to);
          const hi = Math.max(from, to);
          const back = to < from;
          // 44px each where there's room. Two readings close in value would
          // otherwise stack their hover areas and hide the older one's tooltip,
          // so a crowded step gives up width down to its neighbour's edge.
          const gap = Math.min(
            i > 0 ? Math.abs(to - steps[i - 1].to) : 100,
            i < steps.length - 1 ? Math.abs(steps[i + 1].to - to) : 100
          );
          const tip =
            to < 25
              ? "left-1/2 -translate-x-[10px]"
              : to > 75
              ? "right-1/2 translate-x-[10px]"
              : "left-1/2 -translate-x-1/2";

          return (
            <React.Fragment key={r.id}>
              <div
                aria-hidden
                className={`absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full
                            transition-[left,width] duration-500 ease-settle ${
                              back
                                ? "bg-owed-500"
                                : last
                                ? done
                                  ? "bg-clean-500"
                                  : "bg-ink"
                                : "bg-ink-faint"
                            }`}
                // A step back is short and starts where the next one starts, so
                // it has to sit above its neighbours or the recovery paints over it.
                style={{
                  left: `${lo}%`,
                  width: `max(3px, calc(${hi - lo}% - 3px))`,
                  zIndex: back ? 1 : undefined,
                }}
              />

              {/*
                A notch is a labelled mark, not a control — there is nothing to
                press. role="img" keeps the reading readable to a screen reader
                without putting a dead button in the tab order.
              */}
              <span
                role="img"
                style={{
                  left: `${to}%`,
                  zIndex: 10 + i,
                  width: `min(2.75rem, max(1.25rem, ${gap}%))`,
                }}
                aria-label={
                  `Reading ${i + 1} of ${steps.length}: ${num(r.value)}${unit}, ` +
                  `${move >= 0 ? "up" : "down"} ${num(Math.abs(move))}${unit}, ${stamp(r.recordedAt)}` +
                  (r.note ? `. ${r.note}` : "")
                }
                className="group absolute top-0 h-11 -translate-x-1/2 grid place-items-center rounded-full"
              >
                <span
                  className={`block rounded-full transition-transform duration-200 ease-settle
                              group-hover:scale-125 ${
                                last
                                  ? `h-3.5 w-3.5 ${done ? "bg-clean-500" : "bg-ink"}`
                                  : back
                                  ? "h-2 w-2 bg-owed-500"
                                  : "h-2 w-2 bg-ink-faint"
                              }`}
                />
                <span
                  aria-hidden
                  className={`pointer-events-none absolute bottom-full mb-1 z-20 w-max max-w-[180px]
                              rounded-lg border border-line bg-paper-card shadow-lift px-2 py-1.5
                              text-left text-[11px] leading-snug text-ink-muted
                              opacity-0 group-hover:opacity-100
                              transition-opacity duration-150 ease-settle ${tip}`}
                >
                  <span className="block font-semibold tnum text-ink">
                    {num(r.value)}
                    {unit}
                    <span className={back ? "text-owed-600" : "text-clean-600"}>
                      {" "}
                      {move >= 0 ? "+" : "−"}
                      {num(Math.abs(move))}
                    </span>
                  </span>
                  {r.note ? <span className="block">{r.note}</span> : null}
                  <span className="block tnum">{stamp(r.recordedAt)}</span>
                </span>
              </span>
            </React.Fragment>
          );
        })}
      </div>

      <p className={`text-xs mt-0.5 tnum ${done ? "text-clean-600" : "text-ink-muted"}`}>
        {newest === null ? (
          "No readings yet — log one and each update lands as its own step."
        ) : (
          <>
            {steps.length} reading{steps.length > 1 ? "s" : ""} ·{" "}
            <strong className={done ? "text-clean-600" : "text-ink"}>
              {num(newest)}
              {unit}
            </strong>{" "}
            · {Math.round(now)}%{done ? " · done" : ""}
          </>
        )}
      </p>
    </div>
  );
};

const GoalBoard: React.FC<GoalBoardProps> = ({
  currentUser,
  user,
  users,
  goals,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
}) => {
  // Players arrive asynchronously, so the choice falls back until one is picked
  // rather than freezing an empty id on first render.
  const [pickedUserId, setPickedUserId] = useState("");
  const [draft, setDraft] = useState({
    category: "",
    description: "",
    from: "",
    to: "",
    unit: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState<string | null>(null);
  const [reading, setReading] = useState("");
  const [readings, setReadings] = useState<Record<string, Reading[]>>({});

  // Every reading for each goal, so the track can show the whole journey.
  //
  // Mount-only. `goals` is a fresh array on every App render, so keying this on
  // it refetched the whole board for nothing — and a new goal has no readings
  // anyway. Logging a reading re-reads explicitly, below.
  useEffect(() => {
    let cancelled = false;
    goalReadings()
      .then((rows) => {
        if (!cancelled) setReadings(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const submitReading = async (goal: Goal) => {
    const value = Number(reading);
    if (!Number.isFinite(value)) return;
    const res = await apiFetch(`/goals/${goal.id}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setError(null);
      // The server owns the row's id and timestamp, so re-read rather than
      // guess — a fabricated step would sit at the wrong date on the track.
      goalReadings().then(setReadings).catch(() => {});
      if (body.completed && !goal.isCompleted) onUpdateGoal({ ...goal, isCompleted: true });
    } else {
      setError(body.error ?? "That reading didn't go through.");
    }
    setLogging(null);
    setReading("");
  };

  const selectedUserId =
    (pickedUserId && users.some((u) => u.id === pickedUserId) ? pickedUserId : "") ||
    user?.id ||
    users[0]?.id ||
    "";

  const selected = users.find((u) => u.id === selectedUserId) ?? null;
  const userGoals = useMemo(
    () => goals.filter((g) => g.userId === selectedUserId),
    [goals, selectedUserId]
  );

  /** Rule 01: your goals are yours to set. Everyone else's are read-only. */
  const isMine = currentUser?.id === selectedUserId;

  // Rule 01, checked as you type so the rejection isn't a surprise on submit.
  const baseline = Number(draft.from);
  const target = Number(draft.to);
  const hasNumbers = draft.from.trim() !== "" && draft.to.trim() !== "" &&
    Number.isFinite(baseline) && Number.isFinite(target);

  const eligibility = draft.description.trim()
    ? goalEligibilityError(draft.description, draft.to) ??
      (hasNumbers
        ? baseline === target
          ? "Start and target can't be the same — there'd be nothing to chase."
          : null
        : "Give it a starting number and a target, so progress can be tracked.")
    : null;

  const submit = () => {
    if (!selectedUserId || !draft.description.trim()) return;
    if (!isMine || eligibility) return;

    onAddGoal({
      id: `${Date.now()}`,
      userId: selectedUserId,
      category: draft.category.trim() || "General",
      description: draft.description.trim(),
      baseline: `${baseline}${draft.unit ? ` ${draft.unit}` : ""}`,
      target: `${target}${draft.unit ? ` ${draft.unit}` : ""}`,
      baselineValue: baseline,
      targetValue: target,
      unit: draft.unit.trim() || undefined,
      isCompleted: false,
      proofs: [],
      createdDate: new Date().toISOString().split("T")[0],
    });

    setDraft({ category: "", description: "", from: "", to: "", unit: "" });
  };

  if (!selected) {
    return (
      <div className="bg-paper-card border border-line rounded-2xl p-10 text-center">
        <p className="display text-2xl text-ink">No players yet</p>
        <p className="text-sm text-ink-muted mt-1">Add players in Admin, then set goals here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="display text-3xl text-ink">Goals</h2>
          <p className="text-sm text-ink-muted mt-1">
            Yours to chase, as many as you like. No points, no budget — just what you're
            aiming at and how far along you are.
          </p>
          {!isMine && selected ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-skip-600">
              <Lock size={13} /> Viewing {selected.name}'s goals — only they can change them.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Viewing
          </span>
          <select
            value={selectedUserId}
            onChange={(e) => setPickedUserId(e.target.value)}
            aria-label="Whose goals to show"
          className="min-h-[44px] pl-3 pr-8 border border-line rounded-xl text-sm font-semibold text-ink
                     bg-paper-card cursor-pointer focus:ring-2 focus:ring-clean-500"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="divide-y divide-line border-y border-line">
        {userGoals.map((goal) => {
          // A goal with numbers. Its completion belongs to its readings.
          const measured = goal.baselineValue != null && goal.targetValue != null;
          return (
          <div
            key={goal.id}
            className=" p-4 flex items-start gap-3
                       transition-shadow duration-150 ease-settle hover:shadow-lift"
          >
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${goal.isCompleted ? "text-ink-muted line-through" : "text-ink"}`}>
                {goal.description}
              </p>
              <p className="text-xs text-ink-muted mt-0.5">
                {goal.category}
                {goal.target ? ` · target ${goal.target}` : ""}
              </p>

              {measured ?<GoalTrack goal={goal} readings={readings[goal.id] ?? []} /> : null}

              {logging === goal.id ? (
                <div className="mt-2 flex gap-2">
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={reading}
                    onChange={(e) => setReading(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitReading(goal)}
                    placeholder={`Latest${goal.unit ? ` (${goal.unit})` : ""}`}
                    aria-label={`Latest reading${goal.unit ? ` in ${goal.unit}` : ""} for ${goal.description}`}
                    className="flex-1 min-h-[44px] px-3 border border-line rounded-lg text-sm bg-paper-card
                               focus:ring-2 focus:ring-clean-500"
                  />
                  <button
                    onClick={() => submitReading(goal)}
                    className="min-h-[44px] px-3 bg-ink text-paper rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              ) : null}
              {logging === goal.id ? (
                <p className="text-xs text-ink-muted mt-1.5 tnum">
                  {goal.isCompleted
                    ? "Already done. Later readings are kept, but it only completes once."
                    : `Reaching ${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ""} completes this goal. Nothing else does.`}
                </p>
              ) : null}
            </div>
            {isMine ? (
              <>
                {/*
                  Rule 05 gives the title to the most goals completed AT TARGET,
                  so a measured goal has no tick — the reading is what completes
                  it, and the server refuses a hand-tick either way. Goals from
                  before the numbers existed keep the toggle.
                */}
                {measured ? (
                  <button
                    onClick={() => {
                      setLogging(logging === goal.id ? null : goal.id);
                      setReading("");
                    }}
                    title={
                      goal.isCompleted
                        ? `Done at ${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ""} — log another reading`
                        : `Log a reading. ${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ""} completes it.`
                    }
                    className={`min-w-[44px] min-h-[44px] grid place-items-center rounded-lg cursor-pointer
                      transition-colors duration-150 ease-settle ${
                        goal.isCompleted
                          ? "bg-clean-100 text-clean-700"
                          : "bg-paper-sunk text-ink-muted hover:bg-clean-100 hover:text-clean-700"
                      }`}
                  >
                    {goal.isCompleted ? <Check size={15} /> : <TrendingUp size={15} />}
                  </button>
                ) : (
                  <button
                    onClick={() => onUpdateGoal({ ...goal, isCompleted: !goal.isCompleted })}
                    title={goal.isCompleted ? "Mark not done" : "Mark completed"}
                    className={`min-w-[44px] min-h-[44px] grid place-items-center rounded-lg cursor-pointer
                      transition-colors duration-150 ease-settle ${
                        goal.isCompleted ? "bg-clean-100 text-clean-700" : "bg-paper-sunk text-ink-muted hover:text-ink"
                      }`}
                  >
                    <Check size={15} />
                  </button>
                )}
                <button
                  onClick={() => onDeleteGoal(goal.id)}
                  title="Delete goal"
                  className="min-w-[44px] min-h-[44px] grid place-items-center rounded-lg bg-paper-sunk text-ink-muted
                             cursor-pointer transition-colors duration-150 ease-settle hover:bg-owed-50 hover:text-owed-600"
                >
                  <Trash2 size={15} />
                </button>
              </>
            ) : null}
          </div>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-owed-600 bg-owed-50 border border-owed-100 rounded-xl px-3 py-2">
          {error}
        </p>
      ) : null}

      {isMine ? (
        <div className="pt-5 space-y-3">
          <label className="block text-xs text-ink-muted">
            The goal
            <input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="What are you going to do? (e.g. Bench 80kg for 5)"
              aria-invalid={eligibility ? true : undefined}
              aria-describedby={eligibility ? ELIGIBILITY_ID : undefined}
              className="mt-1 w-full min-h-[44px] px-3 border border-line rounded-xl text-sm bg-paper-card
                         focus:ring-2 focus:ring-clean-500 focus:border-clean-500"
            />
          </label>
          <label className="block text-xs text-ink-muted">
            Category
            <input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="Your category"
              className="mt-1 w-full min-h-[44px] px-3 border border-line rounded-xl text-sm bg-paper-card
                         focus:ring-2 focus:ring-clean-500 focus:border-clean-500"
            />
          </label>

          {/* Where you start and what counts as done — the two numbers a progress bar needs. */}
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
            <label className="text-xs text-ink-muted">
              Today
              <input
                inputMode="decimal"
                value={draft.from}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                placeholder="70"
                aria-invalid={eligibility && !hasNumbers ? true : undefined}
                aria-describedby={eligibility ? ELIGIBILITY_ID : undefined}
                className="mt-1 w-full min-h-[44px] px-3 border border-line rounded-xl text-sm bg-paper-card tnum
                           focus:ring-2 focus:ring-clean-500 focus:border-clean-500"
              />
            </label>
            <label className="text-xs text-ink-muted">
              Target
              <input
                inputMode="decimal"
                value={draft.to}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                placeholder="100"
                aria-invalid={eligibility && !hasNumbers ? true : undefined}
                aria-describedby={eligibility ? ELIGIBILITY_ID : undefined}
                className="mt-1 w-full min-h-[44px] px-3 border border-line rounded-xl text-sm bg-paper-card tnum
                           focus:ring-2 focus:ring-clean-500 focus:border-clean-500"
              />
            </label>
            <label className="text-xs text-ink-muted">
              Unit
              <input
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                placeholder="kg"
                className="mt-1 w-full min-h-[44px] px-3 border border-line rounded-xl text-sm bg-paper-card
                           focus:ring-2 focus:ring-clean-500 focus:border-clean-500"
              />
            </label>
          </div>
          {hasNumbers && target < baseline ? (
            <p className="text-xs text-ink-muted">
              Target is lower than today, so this one counts down — a time to beat.
            </p>
          ) : null}

          {eligibility ? (
            <p id={ELIGIBILITY_ID} role="alert" className="text-sm text-skip-700 bg-skip-50 border border-skip-100 rounded-xl px-3 py-2">
              {eligibility}
            </p>
          ) : null}

          <button
            onClick={submit}
            disabled={!draft.description.trim() || !!eligibility || !hasNumbers}
            className="w-full flex items-center justify-center gap-2 min-h-[48px] bg-ink text-paper rounded-xl text-sm font-semibold
                       cursor-pointer transition-transform duration-150 ease-settle active:scale-[.99]
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            Add goal
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default GoalBoard;
