import React, { useEffect, useMemo, useState } from "react";
import { Goal } from "../types";
import { apiFetch, latestGoalReadings } from "../services/http";

/**
 * The season in numbers, at group scale.
 *
 * The table above answers "who is where" and the header tiles answer "what is in
 * the pot". This answers the three things neither can: how the group is doing
 * across the whole season, where you sit in the pack, and how the money piled up
 * over time. Nothing here is a statistic anyone has to have been taught — a
 * position, a bar, a running total.
 *
 * Colours are the two the season already has — a clean week is green, money is
 * rust — validated against both grounds.
 */

interface WeekCell {
  week: number;
  outcome: "clean" | "missed";
  credits: number;
  fine: number;
}

export interface StatsRow {
  userId: string;
  name: string;
  cleanWeeks: number;
  cleanStreak: number;
  paid: number;
  outstanding: number;
  weeks: WeekCell[];
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** How far a goal has come, on the numbers rather than on a tick. */
const goalFraction = (goal: Goal, reading?: number): number => {
  if (goal.isCompleted) return 1;
  if (goal.baselineValue == null || goal.targetValue == null || reading == null) return 0;
  if (goal.targetValue === goal.baselineValue) return reading >= goal.targetValue ? 1 : 0;
  return Math.max(0, Math.min(1, (reading - goal.baselineValue) / (goal.targetValue - goal.baselineValue)));
};

const SECTION_HEAD = "text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted";

const GroupStats: React.FC<{ rows: StatsRow[]; currentUserId?: string }> = ({ rows, currentUserId }) => {
  const [goalPct, setGoalPct] = useState<Record<string, number> | null>(null);
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [goalRes, readings] = await Promise.all([apiFetch("/goals"), latestGoalReadings()]);
      if (!goalRes.ok || cancelled) return;
      const goals: Goal[] = await goalRes.json();

      // Every goal counts the same — they carry no weight, so this is a plain
      // average of how far each one has come.
      const byUser: Record<string, { done: number; count: number }> = {};
      goals.forEach((goal) => {
        const bucket = (byUser[goal.userId] ??= { done: 0, count: 0 });
        bucket.count += 1;
        bucket.done += goalFraction(goal, readings[goal.id]);
      });
      if (!cancelled) {
        setGoalPct(
          Object.fromEntries(
            Object.entries(byUser).map(([id, b]) => [id, b.count ? b.done / b.count : 0])
          )
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** One row per week, counted across everybody who played it, with the running bill. */
  const weeks = useMemo(() => {
    const played = Math.max(0, ...rows.map((r) => r.weeks.length));
    let running = 0;
    return Array.from({ length: played }, (_, i) => {
      const cells = rows.map((r) => r.weeks[i]).filter(Boolean);
      const fined = cells.reduce((sum, c) => sum + c.fine, 0);
      running += fined;
      return {
        week: cells[0]?.week ?? i + 1,
        clean: cells.filter((c) => c.outcome === "clean").length,
        missed: cells.filter((c) => c.outcome === "missed").length,
        fined,
        running,
        players: cells.length,
      };
    });
  }, [rows]);

  /** Clean weeks, most first. Ties share a position, so 1st, 1st, 3rd. */
  const standing = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.cleanWeeks - a.cleanWeeks || b.cleanStreak - a.cleanStreak);
    return sorted.map((r) => ({
      ...r,
      place: sorted.findIndex((o) => o.cleanWeeks === r.cleanWeeks) + 1,
    }));
  }, [rows]);

  const me = standing.find((r) => r.userId === currentUserId) ?? null;
  const leader = standing[0] ?? null;
  const mostClean = Math.max(1, ...rows.map((r) => r.cleanWeeks));

  const billedTotal = weeks.length ? weeks[weeks.length - 1].running : 0;
  const hovered = weeks.find((w) => w.week === hoverWeek) ?? null;

  const best = weeks.reduce<(typeof weeks)[number] | null>(
    (b, w) => (!b || w.clean / w.players > b.clean / b.players ? w : b),
    null
  );
  const worst = weeks.reduce<(typeof weeks)[number] | null>(
    (b, w) => (!b || w.missed / w.players > b.missed / b.players ? w : b),
    null
  );

  const ranked = [...rows].sort((a, b) => (goalPct?.[b.userId] ?? 0) - (goalPct?.[a.userId] ?? 0));

  /** 24 week labels do not fit a phone, so only the landmarks are printed. */
  const labelled = (week: number, i: number) =>
    weeks.length <= 12 || i === 0 || i === weeks.length - 1 || week % 4 === 0;

  if (!weeks.length) {
    return (
      <p className="text-sm text-ink-muted">No weeks have closed yet — the numbers start after Week 1.</p>
    );
  }

  return (
    <section className="space-y-10">
      <div>
        <h3 className="display text-2xl">The numbers</h3>
        <p className="text-sm text-ink-muted mt-0.5 tnum">
          {weeks.length} week{weeks.length === 1 ? "" : "s"} closed · {rows.length} players
        </p>
      </div>

      {/* 1 — where one player sits in the pack, as a plain finishing order */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h4 className={SECTION_HEAD}>Clean weeks — the order</h4>
          {me && leader ? (
            <p className="text-sm text-ink tnum">
              <span className="font-semibold">
                {me.place === 1 ? "You lead" : `You are ${ordinal(me.place)} of ${rows.length}`}
              </span>
              {me.place === 1
                ? ` — ${me.cleanWeeks} clean week${me.cleanWeeks === 1 ? "" : "s"}`
                : ` — ${leader.cleanWeeks - me.cleanWeeks} behind ${leader.name}`}
            </p>
          ) : null}
        </div>

        <ul className="mt-3 space-y-2.5">
          {standing.map((r) => {
            const isMe = r.userId === currentUserId;
            return (
              <li key={r.userId} className="flex items-center gap-3">
                <span className="text-xs tnum text-ink-muted w-7 shrink-0 text-right">
                  {ordinal(r.place)}
                </span>
                <span
                  className={`text-sm w-20 sm:w-28 shrink-0 truncate ${
                    isMe ? "font-semibold text-ink" : "text-ink-muted"
                  }`}
                >
                  {r.name}
                </span>
                <span
                  className="flex-1 h-2.5 rounded-full bg-paper-sunk overflow-hidden"
                  role="img"
                  aria-label={`${r.name}: ${r.cleanWeeks} clean weeks, ${ordinal(r.place)} of ${rows.length}`}
                >
                  <span
                    className="block h-full rounded-full transition-[width] duration-300 ease-settle"
                    style={{
                      width: `${Math.max((r.cleanWeeks / mostClean) * 100, r.cleanWeeks ? 2 : 0)}%`,
                      background: isMe ? "rgb(var(--chart-clean))" : "rgb(var(--ink-faint))",
                    }}
                  />
                </span>
                <span
                  className={`text-sm tnum w-16 sm:w-24 text-right shrink-0 ${
                    isMe ? "text-ink" : "text-ink-muted"
                  }`}
                  title={`${r.cleanStreak} clean weeks in a row right now`}
                >
                  {r.cleanWeeks}
                  <span className="text-ink-faint"> · {r.cleanStreak}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-ink-muted mt-2">
          Clean weeks all season · current run of clean weeks in a row.
        </p>
      </div>

      {/* 2 — how the whole group handled each week */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h4 className={SECTION_HEAD}>Every week, everybody</h4>
          <p className="text-sm text-ink tnum" role="status">
            {hovered ? (
              <>
                <span className="font-semibold">Week {hovered.week}</span> — {hovered.clean} clean ·{" "}
                {hovered.missed} fined
              </>
            ) : (
              <span className="text-ink-muted">Tap a week for the split</span>
            )}
          </p>
        </div>

        <div
          className="flex gap-1 h-36 mt-3 items-end"
          onMouseLeave={() => setHoverWeek(null)}
          role="img"
          aria-label={`How many of the ${rows.length} players went clean and how many were fined, each week from ${weeks[0].week} to ${weeks[weeks.length - 1].week}`}
        >
          {weeks.map((w) => (
            <div
              key={w.week}
              onMouseEnter={() => setHoverWeek(w.week)}
              onClick={() => setHoverWeek(w.week)}
              title={`Week ${w.week} — ${w.clean} clean, ${w.missed} fined`}
              className={`flex-1 h-full flex flex-col gap-[2px] justify-end cursor-default transition-opacity
                          duration-150 ease-settle ${hovered && hovered.week !== w.week ? "opacity-40" : ""}`}
            >
              {w.missed ? (
                <div
                  style={{ height: `${(w.missed / w.players) * 100}%`, background: "rgb(var(--chart-owed))" }}
                  className="rounded-t-md"
                />
              ) : null}
              {w.clean ? (
                <div
                  style={{ height: `${(w.clean / w.players) * 100}%`, background: "rgb(var(--chart-clean))" }}
                  className={w.missed ? "rounded-b-md" : "rounded-md"}
                />
              ) : null}
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-1.5">
          {weeks.map((w, i) => (
            <span key={w.week} className="flex-1 text-center text-[10px] text-ink-muted tnum">
              {labelled(w.week, i) ? w.week : " "}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mt-3">
          <ul className="flex flex-wrap gap-4 text-xs text-ink-muted">
            {[
              ["Clean", "rgb(var(--chart-clean))"],
              ["Fined", "rgb(var(--chart-owed))"],
            ].map(([label, fill]) => (
              <li key={label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: fill }} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
          {best && worst ? (
            <p className="text-xs text-ink-muted tnum">
              Best week {best.week} — {best.clean} of {best.players} clean · Roughest week {worst.week} —{" "}
              {worst.missed} fined
            </p>
          ) : null}
        </div>
      </div>

      {/* 3 — how the money piled up, which the standings table cannot show */}
      {billedTotal > 0 ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h4 className={SECTION_HEAD}>What the season has cost</h4>
            <p className="text-sm text-ink tnum" role="status">
              {hovered ? (
                <>
                  <span className="font-semibold">By week {hovered.week}</span> — {rupees(hovered.running)}
                  {hovered.fined ? ` · ${rupees(hovered.fined)} that week` : " · nothing that week"}
                </>
              ) : (
                <>
                  <span className="font-semibold">{rupees(billedTotal)}</span>
                  <span className="text-ink-muted"> billed so far</span>
                </>
              )}
            </p>
          </div>

          <div
            className="flex gap-1 h-24 mt-3 items-end"
            onMouseLeave={() => setHoverWeek(null)}
            role="img"
            aria-label={`Running total of fines billed, climbing to ${rupees(billedTotal)} by week ${
              weeks[weeks.length - 1].week
            }`}
          >
            {weeks.map((w) => (
              <div
                key={w.week}
                onMouseEnter={() => setHoverWeek(w.week)}
                onClick={() => setHoverWeek(w.week)}
                title={`By week ${w.week} — ${rupees(w.running)}`}
                className={`flex-1 h-full flex flex-col justify-end cursor-default transition-opacity
                            duration-150 ease-settle ${hovered && hovered.week !== w.week ? "opacity-40" : ""}`}
              >
                <div
                  className="rounded-t-md"
                  style={{
                    height: `${Math.max(w.running ? 3 : 0, (w.running / billedTotal) * 100)}%`,
                    background: "rgb(var(--chart-owed))",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-1.5">
            {weeks.map((w, i) => (
              <span key={w.week} className="flex-1 text-center text-[10px] text-ink-muted tnum">
                {labelled(w.week, i) ? w.week : " "}
              </span>
            ))}
          </div>
          <p className="text-xs text-ink-muted mt-2">
            Every fine the season has billed, added up as the weeks went by. A tall step is a week the group
            paid for. Paid fines are the pot.
          </p>
        </div>
      ) : null}

      {/* 4 — how far the goals have actually moved */}
      <div>
        <h4 className={SECTION_HEAD}>Goal progress</h4>
        <p className="text-sm text-ink-muted mt-0.5">
          How far each player's goals have come, averaged across all of them.
        </p>

        {goalPct === null ? (
          <div className="h-40 mt-3 rounded-xl bg-line-soft animate-pulse" />
        ) : (
          <ul className="mt-3 space-y-2.5">
            {ranked.map((r) => {
              const pct = goalPct[r.userId] ?? 0;
              const isMe = r.userId === currentUserId;
              return (
                <li key={r.userId} className="flex items-center gap-3">
                  <span
                    className={`text-sm w-24 shrink-0 truncate ${isMe ? "font-semibold text-ink" : "text-ink-muted"}`}
                  >
                    {r.name}
                  </span>
                  <span
                    className="flex-1 h-2.5 rounded-full bg-paper-sunk overflow-hidden"
                    role="img"
                    aria-label={`${r.name}: goals ${Math.round(pct * 100)} percent of the way there`}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(pct * 100, pct > 0 ? 2 : 0)}%`,
                        background: isMe ? "rgb(var(--chart-clean))" : "rgb(var(--ink-faint))",
                      }}
                    />
                  </span>
                  <span className="text-sm tnum text-ink-muted w-12 text-right">
                    {Math.round(pct * 100)}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default GroupStats;
