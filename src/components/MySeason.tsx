import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  IndianRupee,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Trophy,
} from "lucide-react";
import { User, WeeklyPlan, WorkoutDay } from "../types";
import WeeklyPlanModal from "./WeeklyPlanModal";
import { getWeekDates } from "../utils/dateUtils";

/**
 * The home screen, written for one person: your week first, your money second,
 * the group after that. Everything shown here is derived by the server from the
 * workout sheet — this screen only reports what the rules already decided.
 */

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const SEASON_WEEKS = 24;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Standing = "active" | "suspended" | "out";

interface UnsettledFine {
  id: string;
  week: number;
  amount: number;
  overdue: boolean;
}

interface SeasonView {
  userId: string;
  name: string;
  currentWeek: number;
  priceLevel: 1 | 2 | 3;
  fineIfMissed: number;
  standing: Standing;
  cleanWeeks: number;
  missedWeeks: number;
  cleanStreak: number;
  missesAtLevel: number;
  tokensLeft: number;
  billed: number;
  paid: number;
  outstanding: number;
  potEligible: boolean;
  weeks: { week: number; outcome: "clean" | "missed" | "skipped"; workouts: number; fine: number }[];
  currentWeekProgress: { week: number; workouts: number; needed: number };
  unsettledFines: UnsettledFine[];
}

interface MySeasonProps {
  currentUser: User | null;
  workoutDays: WorkoutDay[];
  weeklyPlans: WeeklyPlan[];
  onUpdateWorkoutDay: (day: WorkoutDay) => void;
  onUpdateWeeklyPlan: (plan: {
    userId: string;
    week: number;
    committedDays: number[];
    createdBy?: "user" | "admin";
  }) => Promise<WeeklyPlan | undefined> | Promise<WeeklyPlan>;
  challengeStartDate: string;
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const STANDING_STYLE: Record<Standing, string> = {
  active: "bg-clean-100 text-clean-700",
  suspended: "bg-skip-100 text-skip-700",
  out: "bg-owed-100 text-owed-700",
};

const OUTCOME_STYLE = {
  clean: "bg-clean-500",
  missed: "bg-owed-500",
  skipped: "bg-skip-500",
} as const;

const OUTCOME_LABEL = { clean: "Clean", missed: "Fined", skipped: "Skipped" } as const;

/** The season so far, plus the week still running, as one strip. */
const WeekStrip: React.FC<{ view: SeasonView; compact?: boolean }> = ({ view, compact }) => (
  <div className="flex gap-1" role="list" aria-label={`${view.name}'s weeks`}>
    {view.weeks.map((w) => (
      <div
        key={w.week}
        role="listitem"
        title={`Week ${w.week}: ${w.workouts} workouts — ${OUTCOME_LABEL[w.outcome]}${
          w.fine ? ` (${rupees(w.fine)})` : ""
        }`}
        className={`flex-1 rounded-md ${compact ? "h-2.5" : "h-8"} ${OUTCOME_STYLE[w.outcome]}`}
      />
    ))}
    {/* The current week is still open, so it reads as an outline, not a verdict. */}
    <div
      role="listitem"
      title={`Week ${view.currentWeekProgress.week}: ${view.currentWeekProgress.workouts} of ${view.currentWeekProgress.needed} so far — still running`}
      className={`flex-1 rounded-md border-2 border-dashed border-ink-faint relative overflow-hidden ${
        compact ? "h-2.5" : "h-8"
      }`}
    >
      <div
        className="absolute inset-x-0 bottom-0 bg-clean-500/40"
        style={{
          height: `${Math.min(100, (view.currentWeekProgress.workouts / view.currentWeekProgress.needed) * 100)}%`,
        }}
      />
    </div>
  </div>
);


/**
 * What the app should be telling this player right now.
 *
 * The numbers were always there — how many workouts are left, how many days are
 * left, what a miss costs. Nobody was being told.
 */
const nudgeFor = (
  done: number,
  needed: number,
  daysLeft: number,
  fine: number,
  outstanding: number,
  standing: Standing
): { tone: "owed" | "skip" | "clean"; text: string } | null => {
  if (standing === "out") return null;

  if (outstanding > 0) {
    return {
      tone: "owed",
      text: `${rupees(outstanding)} is due. Carry it into next week and you're suspended — no pot until you clear it.`,
    };
  }

  const left = needed - done;
  if (left <= 0) {
    return { tone: "clean", text: "This week is clean. Three in a row and the price of a miss drops." };
  }
  if (left > daysLeft) {
    return {
      tone: "owed",
      text: `${left} workouts left and only ${daysLeft} day${daysLeft === 1 ? "" : "s"} to do them. This week costs ${rupees(fine)}.`,
    };
  }
  if (left === daysLeft) {
    return {
      tone: "skip",
      text: `${left} left, ${daysLeft} day${daysLeft === 1 ? "" : "s"} to go — every remaining day counts, or it's ${rupees(fine)}.`,
    };
  }
  return null;
};

const MySeason: React.FC<MySeasonProps> = ({
  currentUser,
  workoutDays,
  weeklyPlans,
  onUpdateWorkoutDay,
  onUpdateWeeklyPlan,
  challengeStartDate,
}) => {
  const [planOpen, setPlanOpen] = useState(false);
  const [players, setPlayers] = useState<SeasonView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const usersRes = await fetch(`${API}/users`);
      if (!usersRes.ok) throw new Error(`Could not load players (${usersRes.status})`);
      const users = await usersRes.json();
      const seasons = await Promise.all(
        users.map(async (u: { id: string }) => {
          const res = await fetch(`${API}/season/${u.id}`);
          if (!res.ok) throw new Error(`Could not load season for ${u.id}`);
          return res.json();
        })
      );
      setPlayers(seasons);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const me = useMemo(
    () => players.find((p) => p.userId === currentUser?.id) ?? null,
    [players, currentUser]
  );
  const call = async (url: string, body?: object) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setNotice(data.error ?? "That didn't work");
      await load();
      return res.ok;
    } finally {
      setBusy(false);
    }
  };

  /** Log or unlog a day in the running week. Your sheet only. */
  const toggleDay = (dayOfWeek: number) => {
    if (!currentUser || !me) return;
    const week = me.currentWeekProgress.week;
    const existing = workoutDays.find(
      (w) => w.userId === currentUser.id && w.week === week && w.dayOfWeek === dayOfWeek
    );

    onUpdateWorkoutDay({
      id: existing?.id || `workout-${currentUser.id}-${week}-${dayOfWeek}-${Date.now()}`,
      userId: currentUser.id,
      week,
      dayOfWeek,
      date: new Date().toISOString().split("T")[0],
      isCompleted: !existing?.isCompleted,
      workoutType: existing?.workoutType ?? "gym",
      notes: existing?.notes,
      markedBy: "user",
      timestamp: new Date().toISOString(),
    });

    // The server re-derives fines and standing from the sheet.
    setTimeout(load, 400);
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading your season">
        <div className="h-56 rounded-2xl bg-line-soft animate-pulse" />
        <div className="h-32 rounded-2xl bg-line-soft animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-owed-50 border border-owed-100 rounded-2xl p-5 text-owed-700">
        <p className="font-semibold mb-1">{error}</p>
        <p className="text-sm text-ink-muted">
          Start the API with <code className="font-mono">PORT=5000 node backend/server.js</code>, then retry.
        </p>
        <button onClick={load} className="mt-4 min-h-[44px] px-4 bg-owed-500 text-paper rounded-xl text-sm font-semibold">
          Retry
        </button>
      </div>
    );
  }

  const thisWeekPlan =
    weeklyPlans.find((p) => p.userId === currentUser?.id && p.week === me?.currentWeekProgress.week) ?? null;
  // 1 = Monday … 7 = Sunday, matching the week-end day locked at Week 0.
  const todayDow = ((new Date().getDay() + 6) % 7) + 1;
  const weekEndDay = currentUser?.weekEndDay ?? 7;
  const daysLeft = Math.max(0, weekEndDay - todayDow + 1);
  const done = me?.currentWeekProgress.workouts ?? 0;
  const needed = me?.currentWeekProgress.needed ?? 5;
  const left = Math.max(0, needed - done);

  return (
    <div className="space-y-5">
      {notice ? (
        <div role="status" className="text-sm border border-line bg-paper-card rounded-xl px-4 py-3 text-ink">
          {notice}
        </div>
      ) : null}

      {me ? (
        <section className="overflow-hidden">
          <div className="pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  Week {me.currentWeek} of {SEASON_WEEKS}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <h2 className="display text-3xl">{me.name}</h2>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-[0.08em] ${STANDING_STYLE[me.standing]}`}
                  >
                    {me.standing}
                  </span>
                  {me.potEligible ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-clean-600">
                      <Trophy size={13} aria-hidden="true" /> in for the pot
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                  A miss costs
                </p>
                <p className="display text-3xl tnum text-ink">{rupees(me.fineIfMissed)}</p>
              </div>
            </div>


            {me
              ? (() => {
                  const nudge = nudgeFor(done, needed, daysLeft, me.fineIfMissed, me.outstanding, me.standing);
                  if (!nudge) return null;
                  const tone = {
                    owed: "bg-owed-50 text-owed-700",
                    skip: "bg-skip-50 text-skip-700",
                    clean: "bg-clean-50 text-clean-700",
                  }[nudge.tone];
                  return (
                    <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${tone}`}>
                      {nudge.text}
                    </p>
                  );
                })()
              : null}

            {/* This week, and the only thing to do about it. */}
            <div className="mt-5">
              <div className="flex items-baseline justify-between mb-2">
                <p className="font-semibold text-ink">
                  {left === 0 ? "This week is clean" : `${left} more workout${left === 1 ? "" : "s"} this week`}
                </p>
                <p className="text-sm tnum text-ink-muted">
                  {done}/{needed}
                </p>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((label, i) => {
                  const dow = i + 1;
                  const logged = workoutDays.some(
                    (w) =>
                      w.userId === me.userId &&
                      w.week === me.currentWeekProgress.week &&
                      w.dayOfWeek === dow &&
                      w.isCompleted
                  );
                  return (
                    <button
                      key={label}
                      onClick={() => toggleDay(dow)}
                      disabled={me.standing === "out"}
                      aria-pressed={logged}
                      aria-label={`${label}: ${logged ? "logged" : "not logged"}`}
                      className={`min-h-[56px] rounded-xl border text-xs font-semibold cursor-pointer
                        transition-colors duration-150 ease-settle disabled:opacity-40 disabled:cursor-not-allowed
                        ${
                          logged
                            ? "bg-clean-500 border-clean-500 text-paper"
                            : "bg-paper-card border-line text-ink-muted hover:border-clean-500 hover:text-clean-600"
                        }`}
                    >
                      <span className="block">{label}</span>
                      {logged ? <Check size={14} className="mx-auto mt-1" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* The numbers a player actually tracks. */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 border-t border-line sm:divide-x divide-line">
            <div className="py-4 pr-4 sm:px-4 sm:first:pl-0 border-b border-line">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Clean weeks</dt>
              <dd className="display text-2xl tnum mt-0.5 text-clean-600">{me.cleanWeeks}</dd>
            </div>
            <div className="py-4 pr-4 sm:px-4 border-b border-line">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Streak</dt>
              <dd className="display text-2xl tnum mt-0.5 text-ink">{me.cleanStreak}</dd>
            </div>
            <div className="py-4 pr-4 sm:px-4 border-b border-line">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Paid in</dt>
              <dd className="display text-2xl tnum mt-0.5 text-ink">{rupees(me.paid)}</dd>
            </div>
            <div className="py-4 pr-4 sm:px-4 border-b border-line">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Skips left</dt>
              <dd className="display text-2xl tnum mt-0.5 text-ink">{me.tokensLeft}</dd>
            </div>
          </dl>

          <div className="pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted mb-2">
              Your season
            </p>
            <WeekStrip view={me} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-ink-muted">
              <span className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-sm bg-clean-500" aria-hidden="true" /> {me.cleanWeeks} clean
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-sm bg-owed-500" aria-hidden="true" /> {me.missedWeeks} fined
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-sm bg-skip-500" aria-hidden="true" /> {3 - me.tokensLeft} skipped
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-sm border-2 border-dashed border-ink-faint" aria-hidden="true" /> this week
              </span>
            </div>
          </div>


          {/* Rule 06: commit the days, and swap one if the week goes sideways. */}
          <div className="pt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              {thisWeekPlan
                ? `Committed to ${thisWeekPlan.committedDays.length} days${
                    thisWeekPlan.swapsUsed ? " · swap spent" : " · one swap available"
                  }`
                : "No plan committed for this week"}
            </p>
            <button
              onClick={() => setPlanOpen(true)}
              className="min-h-[40px] px-3 border border-line rounded-lg text-xs font-semibold text-ink
                         bg-paper-card cursor-pointer hover:border-clean-500 hover:text-clean-600"
            >
              {thisWeekPlan ? "Plan & swaps" : "Commit days"}
            </button>
          </div>

          {/* Money you owe, and the one action that clears it. */}
          {me.unsettledFines.length > 0 ? (
            <ul className="border-t border-line pt-4 mt-5 space-y-1.5">
              {me.unsettledFines.map((f) => (
                <li
                  key={f.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2 ${
                    f.overdue ? "bg-owed-50" : "bg-paper-sunk"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm">
                    {f.overdue ? (
                      <AlertTriangle size={15} className="text-owed-500" aria-hidden="true" />
                    ) : (
                      <IndianRupee size={15} className="text-skip-500" aria-hidden="true" />
                    )}
                    <span className="font-semibold tnum text-ink">
                      Week {f.week} — {rupees(f.amount)}
                    </span>
                    <span className={f.overdue ? "text-owed-600" : "text-ink-muted"}>
                      {f.overdue ? "past its 48 hours" : "due within 48 hours"}
                    </span>
                  </span>
                  <button
                    onClick={() => call(`${API}/fines/${f.id}/settle`)}
                    disabled={busy || me.standing === "out"}
                    className="min-h-[40px] px-4 bg-ink text-paper rounded-lg text-xs font-semibold cursor-pointer
                               disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    Mark paid
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-t border-line pt-4 mt-5 flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-clean-600">
                <ShieldCheck size={15} aria-hidden="true" /> Nothing outstanding
              </span>
              <button
                onClick={() =>
                  call(`${API}/skip-tokens`, {
                    userId: me.userId,
                    week: me.currentWeek + 1,
                    approvedBy: "group",
                  })
                }
                disabled={busy || me.tokensLeft === 0 || me.currentWeek + 1 > SEASON_WEEKS - 2}
                className="flex items-center gap-1.5 min-h-[40px] px-3 border border-line rounded-lg text-xs font-semibold
                           text-ink bg-paper-card cursor-pointer hover:border-skip-500 hover:text-skip-600
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Ticket size={14} aria-hidden="true" />
                Skip next week ({me.tokensLeft} left)
              </button>
            </div>
          )}
        </section>
      ) : null}


      {planOpen && currentUser && me ? (
        <WeeklyPlanModal
          isOpen={planOpen}
          onClose={() => setPlanOpen(false)}
          user={currentUser}
          week={me.currentWeekProgress.week}
          weekDates={getWeekDates(challengeStartDate, me.currentWeekProgress.week)}
          existingPlan={thisWeekPlan}
          lockReason={thisWeekPlan ? "deadline-passed" : null}
          swapsUsed={thisWeekPlan?.swapsUsed ?? 0}
          onSave={async (days) => {
            await onUpdateWeeklyPlan({
              userId: currentUser.id,
              week: me.currentWeekProgress.week,
              committedDays: days,
              createdBy: "user",
            });
            setPlanOpen(false);
          }}
          onSwap={async (from, to) => {
            const res = await fetch(
              `${API}/weekly-plans/${currentUser.id}/${me.currentWeekProgress.week}/swap`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ from, to }),
              }
            );
            const body = await res.json().catch(() => ({}));
            if (res.ok) load();
            return res.ok ? null : body.error;
          }}
        />
      ) : null}
    </div>
  );
};

export default MySeason;