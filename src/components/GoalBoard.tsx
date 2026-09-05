import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Gavel, Lock, Plus, Stamp, TrendingUp, Trash2 } from "lucide-react";
import { Goal, GOAL_BUDGET, GOAL_TIERS, User } from "../types";
import { goalEligibilityError, goalProgressFraction } from "../utils/seasonEngine";
import { apiFetch, latestGoalReadings } from "../services/http";

/**
 * Rule 02: every player spends exactly 6 points across 2 to 6 goals.
 *
 * The budget is the whole interface — you can only add a goal the remaining
 * points can pay for, so an illegal split is never reachable.
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

/** Rule 04: what the group has been asked to replace, as the server records it. */
interface Petition {
  id: string;
  goalId: string;
  raisedBy: string;
  raisedByName: string;
  reason: string | null;
  status: string;
  raisedAt: string;
}

/** Heaviest goal reads heaviest. The tier is legible from the chip alone. */
const TIER_STYLE: Record<number, string> = {
  3: "bg-ink text-paper",
  2: "bg-clean-100 text-clean-700",
  1: "bg-paper-sunk text-ink-muted",
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
    points: 3 as 1 | 2 | 3,
  });
  const [petitions, setPetitions] = useState<Petition[]>([]);
  /**
   * Sign-offs made in this session. The goals themselves are App's to own and
   * it only reloads them on a refresh, so a just-approved goal reads as live
   * straight away rather than waiting a page load to catch up.
   */
  const [signedOff, setSignedOff] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState<string | null>(null);
  const [reading, setReading] = useState("");
  const [latest, setLatest] = useState<Record<string, number>>({});

  // Petitions live on the server, so every player sees the same ones — the
  // point of raising one is that the rest of the group learns about it.
  const loadPetitions = useCallback(async () => {
    const res = await apiFetch("/goals/petitions");
    if (res.ok) setPetitions(await res.json());
  }, []);

  useEffect(() => {
    loadPetitions().catch(() => {});
  }, [loadPetitions, goals]);

  // The newest reading for each goal, so a bar can show where the player is.
  useEffect(() => {
    let cancelled = false;
    latestGoalReadings()
      .then((readings) => {
        if (!cancelled) setLatest(readings);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [goals]);

  /** Same function the server completes a goal with, so the bar can't lie. */
  const fractionFor = (goal: Goal): number | null =>
    goalProgressFraction(goal.baselineValue, goal.targetValue, latest[goal.id]);

  const openPetition = (goalId: string) =>
    petitions.find((p) => p.goalId === goalId && p.status === "open") ?? null;

  /** Rule 03: live once someone else has signed it off. */
  const signOffAt = (goal: Goal) => goal.approvedAt ?? signedOff[goal.id] ?? null;

  /** Runs an action, surfacing whatever the server said if it says no. */
  const act = async (goalId: string, run: () => Promise<Response>, onOk: (body: any) => void) => {
    setBusy(goalId);
    try {
      const res = await run();
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setError(null);
        onOk(body);
      } else {
        setError(body.error ?? "That didn't go through.");
      }
    } finally {
      setBusy(null);
    }
  };

  const approve = (goal: Goal) =>
    act(
      goal.id,
      () => apiFetch(`/goals/${goal.id}/approve`, { method: "POST" }),
      (body) => setSignedOff((prev) => ({ ...prev, [goal.id]: body.approvedAt }))
    );

  const raisePetition = (goal: Goal) =>
    act(
      goal.id,
      () => apiFetch(`/goals/${goal.id}/petitions`, { method: "POST", body: "{}" }),
      () => {
        loadPetitions().catch(() => {});
      }
    );

  const submitReading = async (goal: Goal) => {
    const value = Number(reading);
    if (!Number.isFinite(value)) return;
    const res = await apiFetch(`/goals/${goal.id}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (res.ok) {
      const body = await res.json();
      setLatest((prev) => ({ ...prev, [goal.id]: value }));
      if (body.completed && !goal.isCompleted) onUpdateGoal({ ...goal, isCompleted: true });
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

  const spent = userGoals.reduce((sum, g) => sum + g.points, 0);
  const left = GOAL_BUDGET - spent;
  const legal = spent === GOAL_BUDGET && userGoals.length >= 2;

  const canAfford = (points: number) => points <= left && userGoals.length < 6;

  /** Rule 04: your goals are yours to set. Everyone else's are read-only. */
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
    if (!selectedUserId || !draft.description.trim() || !canAfford(draft.points)) return;
    if (!isMine || eligibility) return;

    onAddGoal({
      id: `${Date.now()}`,
      userId: selectedUserId,
      category: draft.category.trim() || "General",
      description: draft.description.trim(),
      points: draft.points,
      baseline: `${baseline}${draft.unit ? ` ${draft.unit}` : ""}`,
      target: `${target}${draft.unit ? ` ${draft.unit}` : ""}`,
      baselineValue: baseline,
      targetValue: target,
      unit: draft.unit.trim() || undefined,
      isCompleted: false,
      proofs: [],
      createdDate: new Date().toISOString().split("T")[0],
    });

    setDraft({ category: "", description: "", from: "", to: "", unit: "", points: 1 });
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
            6 points each, across 2 to 6 goals. Agreed by the group before Week 0.
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

      {/* The budget, spent left to right. */}
      <div className="py-5">
        <div
          className="flex gap-1.5 mb-3"
          role="meter"
          aria-valuenow={spent}
          aria-valuemin={0}
          aria-valuemax={GOAL_BUDGET}
          aria-label="Points spent"
        >
          {Array.from({ length: GOAL_BUDGET }).map((_, i) => (
            <div
              key={i}
              className={`h-3 flex-1 rounded-full transition-colors duration-200 ease-settle ${
                i < spent ? (legal ? "bg-clean-500" : "bg-ink") : "bg-line"
              }`}
            />
          ))}
        </div>
        <p className={`text-sm font-semibold tnum ${legal ? "text-clean-600" : "text-ink-muted"}`}>
          {legal
            ? `Legal — ${userGoals.map((g) => g.points).join("+")} = 6 across ${userGoals.length} goals`
            : left > 0
            ? `${spent} of 6 spent — ${left} point${left > 1 ? "s" : ""} left${
                userGoals.length < 2 ? ", and 2 goals minimum" : ""
              }`
            : "One goal only — 2 goals minimum. Break it up."}
        </p>
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
            <span
              className={`text-[11px] font-bold px-2 py-1 rounded-md tnum shrink-0 ${TIER_STYLE[goal.points]}`}
            >
              {goal.points} PT{goal.points > 1 ? "S" : ""}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${goal.isCompleted ? "text-ink-muted line-through" : "text-ink"}`}>
                {goal.description}
              </p>
              <p className="text-xs text-ink-muted mt-0.5">
                {goal.category}
                {goal.target ? ` · target ${goal.target}` : ""}
                {signOffAt(goal) ? " · signed off" : ""}
              </p>

              {/* Rule 03: it isn't live until someone else signs it off. */}
              {!signOffAt(goal) ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em]
                                   text-skip-700 bg-skip-50 border border-skip-100 rounded-md px-2 py-1">
                    <Lock size={11} /> Not live
                  </span>
                  {isMine ? (
                    <span className="text-xs text-ink-muted">
                      Another player has to sign this off before it counts.
                    </span>
                  ) : (
                    <button
                      onClick={() => approve(goal)}
                      disabled={busy === goal.id}
                      className="min-h-[44px] px-3 -my-1.5 rounded-lg text-xs font-semibold text-ink
                                 border border-line bg-paper-card cursor-pointer inline-flex items-center gap-1.5
                                 transition-colors duration-150 ease-settle hover:bg-clean-50 hover:border-clean-500
                                 hover:text-clean-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Stamp size={13} /> Sign off {selected.name}'s goal
                    </button>
                  )}
                </div>
              ) : null}
              {(() => {
                const fraction = fractionFor(goal);
                if (fraction === null) return null;
                const current = latest[goal.id];
                return (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-line overflow-hidden" role="meter"
                      aria-valuenow={Math.round(fraction * 100)} aria-valuemin={0} aria-valuemax={100}
                      aria-label={`${goal.description} progress`}>
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ease-settle ${
                          fraction === 1 ? "bg-clean-500" : "bg-ink"
                        }`}
                        style={{ width: `${fraction * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-ink-muted mt-1 tnum">
                      {goal.baselineValue} → <strong className="text-ink">{current}</strong> →{" "}
                      {goal.targetValue}
                      {goal.unit ? ` ${goal.unit}` : ""} · {Math.round(fraction * 100)}%
                    </p>
                  </div>
                );
              })()}

              {logging === goal.id ? (
                <div className="mt-2 flex gap-2">
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={reading}
                    onChange={(e) => setReading(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitReading(goal)}
                    placeholder={`Latest${goal.unit ? ` (${goal.unit})` : ""}`}
                    className="flex-1 min-h-[40px] px-3 border border-line rounded-lg text-sm bg-paper-card
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

              {(() => {
                const petition = openPetition(goal.id);
                if (!petition) return null;
                return (
                  <p className="text-xs text-clean-700 bg-clean-50 border border-clean-100 rounded-lg
                                px-2.5 py-2 mt-2 leading-relaxed">
                    <strong className="font-semibold">
                      {petition.raisedByName} petitioned to replace this
                    </strong>{" "}
                    on {new Date(petition.raisedAt).toLocaleDateString()}. Set a meeting time. Only
                    people who attend get a vote, the replacement must be worth {goal.points} point
                    {goal.points > 1 ? "s" : ""} or more, and a tie keeps this goal.
                  </p>
                );
              })()}
            </div>
            {isMine ? (
              <>
                {/*
                  Rule 11 gives the title to the most goals completed AT TARGET,
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
                {/* Rule 04: a goal can only be swapped out once it is completed. */}
                {goal.isCompleted ? (
                  <button
                    onClick={() => raisePetition(goal)}
                    disabled={busy === goal.id || openPetition(goal.id) !== null}
                    title={
                      openPetition(goal.id)
                        ? "A petition is already open on this goal"
                        : "Petition the group to replace this goal"
                    }
                    className="min-w-[44px] min-h-[44px] grid place-items-center rounded-lg bg-paper-sunk text-ink-muted
                               cursor-pointer transition-colors duration-150 ease-settle
                               hover:bg-clean-100 hover:text-clean-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Gavel size={15} />
                  </button>
                ) : null}
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

      {isMine && left > 0 && userGoals.length < 6 ? (
        <div className="pt-5 space-y-3">
          <div className="flex gap-2">
            {GOAL_TIERS.map((tier) => (
              <button
                key={tier.points}
                onClick={() => setDraft({ ...draft, points: tier.points })}
                disabled={!canAfford(tier.points)}
                className={`flex-1 min-h-[56px] rounded-xl border text-sm font-semibold cursor-pointer
                  transition-colors duration-150 ease-settle ${
                    draft.points === tier.points
                      ? "border-clean-500 bg-clean-50 text-clean-700"
                      : "border-line text-ink hover:border-ink-faint"
                  } disabled:opacity-35 disabled:cursor-not-allowed`}
              >
                {tier.name}
                <span className={`block text-xs font-normal mt-1 tnum ${draft.points === tier.points ? "text-clean-600" : "text-ink-muted"}`}>
                  {tier.points} pt{tier.points > 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>

          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="What are you going to do? (e.g. Bench 80kg for 5)"
            className="w-full min-h-[44px] px-3 border border-line rounded-xl text-sm bg-paper-card
                       focus:ring-2 focus:ring-clean-500 focus:border-clean-500"
          />
          <input
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            placeholder="Your category"
            className="w-full min-h-[44px] px-3 border border-line rounded-xl text-sm bg-paper-card
                       focus:ring-2 focus:ring-clean-500 focus:border-clean-500"
          />

          {/* Where you start and what counts as done — the two numbers a progress bar needs. */}
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
            <label className="text-xs text-ink-muted">
              Today
              <input
                inputMode="decimal"
                value={draft.from}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                placeholder="70"
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
            <p role="alert" className="text-sm text-skip-700 bg-skip-50 border border-skip-100 rounded-xl px-3 py-2">
              {eligibility}
            </p>
          ) : null}

          <button
            onClick={submit}
            disabled={!draft.description.trim() || !canAfford(draft.points) || !!eligibility || !hasNumbers}
            className="w-full flex items-center justify-center gap-2 min-h-[48px] bg-ink text-paper rounded-xl text-sm font-semibold
                       cursor-pointer transition-transform duration-150 ease-settle active:scale-[.99]
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            Add goal for {draft.points} point{draft.points > 1 ? "s" : ""}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default GoalBoard;
