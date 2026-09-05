import React, { useMemo, useState } from "react";
import { Check, Gavel, Lock, Plus, Trash2 } from "lucide-react";
import { Goal, GOAL_BUDGET, GOAL_TIERS, User } from "../types";
import { goalEligibilityError } from "../utils/seasonEngine";

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

const TIER_STYLE: Record<number, string> = {
  3: "bg-red-100 text-red-800",
  2: "bg-amber-100 text-amber-800",
  1: "bg-teal-100 text-teal-800",
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
  const [draft, setDraft] = useState({ category: "", description: "", target: "", points: 3 as 1 | 2 | 3 });
  const [petitioned, setPetitioned] = useState<string[]>([]);

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
  const eligibility = draft.description.trim()
    ? goalEligibilityError(draft.description, draft.target)
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
      target: draft.target.trim() || undefined,
      isCompleted: false,
      proofs: [],
      createdDate: new Date().toISOString().split("T")[0],
    });

    setDraft({ category: "", description: "", target: "", points: 1 });
  };

  if (!selected) {
    return <div className="text-center py-12 text-gray-500">No players yet.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Goals</h2>
          <p className="text-sm text-gray-500">
            6 points each, across 2 to 6 goals. Agreed by the group before Week 0.
          </p>
          {!isMine && selected ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-amber-700">
              <Lock size={13} /> Viewing {selected.name}'s goals — only they can change them.
            </p>
          ) : null}
        </div>
        <select
          value={selectedUserId}
          onChange={(e) => setPickedUserId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* The budget, spent left to right. */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-1.5 mb-3">
          {Array.from({ length: GOAL_BUDGET }).map((_, i) => (
            <div key={i} className={`h-2.5 flex-1 rounded-full ${i < spent ? "bg-primary-500" : "bg-gray-200"}`} />
          ))}
        </div>
        <p className={`text-sm font-medium ${legal ? "text-green-700" : "text-gray-600"}`}>
          {legal
            ? `Legal — ${userGoals.map((g) => g.points).join("+")} = 6 across ${userGoals.length} goals`
            : left > 0
            ? `${spent} of 6 spent — ${left} point${left > 1 ? "s" : ""} left${
                userGoals.length < 2 ? ", and 2 goals minimum" : ""
              }`
            : "One goal only — 2 goals minimum. Break it up."}
        </p>
      </div>

      <div className="space-y-2">
        {userGoals.map((goal) => (
          <div key={goal.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
            <span className={`text-xs font-bold px-2 py-1 rounded ${TIER_STYLE[goal.points]}`}>
              {goal.points} pt{goal.points > 1 ? "s" : ""}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`font-medium ${goal.isCompleted ? "text-gray-400 line-through" : "text-gray-900"}`}>
                {goal.description}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {goal.category}
                {goal.target ? ` · target ${goal.target}` : ""}
                {goal.approvedAt ? " · approved" : " · awaiting group sign-off"}
              </p>
              {petitioned.includes(goal.id) ? (
                <p className="text-xs text-primary-700 mt-1">
                  Petition raised — set a meeting time. Only people who attend get a vote, the
                  replacement must be worth {goal.points} points or more, and a tie keeps this goal.
                </p>
              ) : null}
            </div>
            {isMine ? (
              <>
                <button
                  onClick={() => onUpdateGoal({ ...goal, isCompleted: !goal.isCompleted })}
                  title={goal.isCompleted ? "Mark not done" : "Mark completed"}
                  className={`p-2 rounded-lg ${goal.isCompleted ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                >
                  <Check size={15} />
                </button>
                {/* Rule 04: a goal can only be swapped out once it is completed. */}
                {goal.isCompleted ? (
                  <button
                    onClick={() => setPetitioned((p) => [...p, goal.id])}
                    disabled={petitioned.includes(goal.id)}
                    title="Petition the group to replace this goal"
                    className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-primary-100 hover:text-primary-700 disabled:opacity-40"
                  >
                    <Gavel size={15} />
                  </button>
                ) : null}
                <button
                  onClick={() => onDeleteGoal(goal.id)}
                  title="Delete goal"
                  className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </>
            ) : null}
          </div>
        ))}
      </div>

      {isMine && left > 0 && userGoals.length < 6 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex gap-2">
            {GOAL_TIERS.map((tier) => (
              <button
                key={tier.points}
                onClick={() => setDraft({ ...draft, points: tier.points })}
                disabled={!canAfford(tier.points)}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                  draft.points === tier.points
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-200 text-gray-700"
                } disabled:opacity-35 disabled:cursor-not-allowed`}
              >
                {tier.name}
                <span className={`block text-xs font-normal ${draft.points === tier.points ? "text-primary-600" : "text-gray-600"}`}>
                  {tier.points} pt{tier.points > 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>

          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="What are you going to do? (e.g. Bench 80kg for 5)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <div className="flex gap-2">
            <input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="Your category"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              value={draft.target}
              onChange={(e) => setDraft({ ...draft, target: e.target.value })}
              placeholder="Target (the number)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {eligibility ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {eligibility}
            </p>
          ) : null}

          <button
            onClick={submit}
            disabled={!draft.description.trim() || !canAfford(draft.points) || !!eligibility}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-semibold disabled:opacity-40"
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
