import React, { useEffect, useMemo, useState } from "react";
import { Goal } from "../types";
import { apiFetch, latestGoalReadings } from "../services/http";

/**
 * The season in numbers, at group scale.
 *
 * The table above answers "who is where". This answers the questions that need
 * the whole group at once: which weeks were hard for everybody, where your own
 * record sits in the pack, and how far the goals have actually moved.
 *
 * Colours are the two the season already has — a clean week is green, money is
 * rust — stepped for charts and validated against both grounds. A skip is a
 * neutral hatch on purpose: it is neither a win nor a miss.
 */

interface WeekCell {
  week: number;
  outcome: "clean" | "missed" | "skipped";
  workouts: number;
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

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** A skip is neither colour, so it gets the one texture in the system. */
const HATCH =
  "repeating-linear-gradient(45deg, rgb(var(--ink-faint) / 0.55) 0 2px, rgb(var(--paper-sunk)) 2px 5px)";

/** How far a goal has come, on the numbers rather than on a tick. */
const goalFraction = (goal: Goal, reading?: number): number => {
  if (goal.isCompleted) return 1;
  if (goal.baselineValue == null || goal.targetValue == null || reading == null) return 0;
  if (goal.targetValue === goal.baselineValue) return reading >= goal.targetValue ? 1 : 0;
  return Math.max(0, Math.min(1, (reading - goal.baselineValue) / (goal.targetValue - goal.baselineValue)));
};

const GroupStats: React.FC<{ rows: StatsRow[]; currentUserId?: string }> = ({ rows, currentUserId }) => {
  const [goalPct, setGoalPct] = useState<Record<string, number> | null>(null);
  const [numbers, setNumbers] = useState(false);
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [goalRes, readings] = await Promise.all([apiFetch("/goals"), latestGoalReadings()]);
      if (!goalRes.ok || cancelled) return;
      const goals: Goal[] = await goalRes.json();

      const byUser: Record<string, { done: number; points: number }> = {};
      goals.forEach((goal) => {
        const bucket = (byUser[goal.userId] ??= { done: 0, points: 0 });
        bucket.points += goal.points;
        bucket.done += goal.points * goalFraction(goal, readings[goal.id]);
      });
      if (!cancelled) {
        setGoalPct(
          Object.fromEntries(
            Object.entries(byUser).map(([id, b]) => [id, b.points ? b.done / b.points : 0])
          )
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** One row per week, counted across everybody who played it. */
  const weeks = useMemo(() => {
    const played = Math.max(0, ...rows.map((r) => r.weeks.length));
    return Array.from({ length: played }, (_, i) => {
      const cells = rows.map((r) => r.weeks[i]).filter(Boolean);
      return {
        week: cells[0]?.week ?? i + 1,
        clean: cells.filter((c) => c.outcome === "clean").length,
        missed: cells.filter((c) => c.outcome === "missed").length,
        skipped: cells.filter((c) => c.outcome === "skipped").length,
        fined: cells.reduce((sum, c) => sum + c.fine, 0),
        players: cells.length,
      };
    });
  }, [rows]);

  const me = rows.find((r) => r.userId === currentUserId) ?? null;
  const maxFine = Math.max(1, ...weeks.map((w) => w.fined));
  const billedTotal = weeks.reduce((sum, w) => sum + w.fined, 0);
  const hovered = weeks.find((w) => w.week === hoverWeek) ?? null;

  const strips = [
    {
      key: "clean",
      label: "Clean weeks",
      value: (r: StatsRow) => r.cleanWeeks,
      format: (n: number) => String(n),
    },
    {
      key: "streak",
      label: "Clean weeks in a row",
      value: (r: StatsRow) => r.cleanStreak,
      format: (n: number) => String(n),
    },
    {
      key: "paid",
      label: "Fines paid",
      value: (r: StatsRow) => r.paid,
      format: (n: number) => rupees(n),
    },
  ];

  const ranked = [...rows].sort((a, b) => (goalPct?.[b.userId] ?? 0) - (goalPct?.[a.userId] ?? 0));

  if (!weeks.length) {
    return (
      <p className="text-sm text-ink-muted">No weeks have closed yet — the numbers start after Week 1.</p>
    );
  }

  return (
    <section className="space-y-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="display text-2xl">The numbers</h3>
          <p className="text-sm text-ink-muted mt-0.5">
            {weeks.length} week{weeks.length === 1 ? "" : "s"} closed · {rupees(billedTotal)} billed
            across the group
          </p>
        </div>
        <button
          onClick={() => setNumbers((n) => !n)}
          aria-pressed={numbers}
          className="min-h-[44px] px-4 border border-line rounded-xl text-sm font-semibold text-ink-muted
                     cursor-pointer transition-colors duration-150 ease-settle hover:border-ink hover:text-ink"
        >
          {numbers ? "Hide numbers" : "Show numbers"}
        </button>
      </div>

      {/* 1 — where one player sits in the pack */}
      {me ? (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            {me.name} against the group
          </h4>
          <div className="mt-3 space-y-5">
            {strips.map((strip) => {
              const values = rows.map(strip.value);
              const lo = Math.min(...values);
              const hi = Math.max(...values);
              const span = hi - lo || 1;
              const mid = median(values);
              const mine = strip.value(me);
              const delta = mine - mid;
              /* Kept off the edges so a dot at the extreme is not half-clipped. */
              const at = (v: number) => 3 + ((v - lo) / span) * 94;

              // Ties would sit on top of each other and hide half the group, so
              // players on the same number stack instead of overlapping.
              const tally: Record<number, number> = {};
              values.forEach((v) => (tally[v] = (tally[v] ?? 0) + 1));
              const seen: Record<number, number> = {};

              return (
                <div key={strip.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-ink">{strip.label}</span>
                    <span className="text-sm tnum text-ink-muted">
                      <span className="font-semibold text-ink">{strip.format(mine)}</span>
                      {" · group median "}
                      {strip.format(mid)}
                      {delta !== 0 ? ` · ${delta > 0 ? "+" : "−"}${strip.format(Math.abs(delta))}` : ""}
                    </span>
                  </div>

                  <div
                    className="relative h-12 mt-2"
                    role="img"
                    aria-label={`${strip.label}: you ${strip.format(mine)}, group median ${strip.format(
                      mid
                    )}, lowest ${strip.format(lo)}, highest ${strip.format(hi)}`}
                  >
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
                    <div
                      className="absolute top-0 bottom-0 w-px bg-ink-faint"
                      style={{ left: `${at(mid)}%` }}
                      title={`Group median ${strip.format(mid)}`}
                    />
                    {rows.map((r) => {
                      const isMe = r.userId === me.userId;
                      const value = strip.value(r);
                      const rank = (seen[value] = (seen[value] ?? 0) + 1) - 1;
                      const gap = Math.min(9, 36 / tally[value]);
                      const offset = (rank - (tally[value] - 1) / 2) * gap;
                      return (
                        <span
                          key={r.userId}
                          title={`${r.name} — ${strip.format(value)}`}
                          style={{ left: `${at(value)}%`, top: `calc(50% + ${offset}px)` }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper ${
                            isMe ? "w-3.5 h-3.5 z-10" : "w-2.5 h-2.5 bg-ink-faint"
                          }`}
                        >
                          {isMe ? (
                            <span
                              className="block w-full h-full rounded-full"
                              style={{ background: "rgb(var(--chart-clean))" }}
                            />
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-ink-muted tnum mt-1">
                    <span>{strip.format(lo)}</span>
                    <span>{strip.format(hi)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 2 — how the whole group handled each week */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Every week, everybody
          </h4>
          <p className="text-sm text-ink-muted tnum" role="status">
            {hovered
              ? `Week ${hovered.week} — ${hovered.clean} clean · ${hovered.missed} fined · ${hovered.skipped} skipped`
              : "Pick a week for the split"}
          </p>
        </div>

        <div
          className="flex gap-1 h-36 mt-3 items-end"
          onMouseLeave={() => setHoverWeek(null)}
          role="img"
          aria-label={`Clean, fined and skipped weeks for all ${rows.length} players, weeks 1 to ${
            weeks[weeks.length - 1].week
          }`}
        >
          {weeks.map((w) => (
            <div
              key={w.week}
              onMouseEnter={() => setHoverWeek(w.week)}
              onClick={() => setHoverWeek(w.week)}
              className="flex-1 h-full flex flex-col gap-[2px] justify-end cursor-default"
            >
              {w.skipped ? (
                <div
                  style={{ height: `${(w.skipped / w.players) * 100}%`, background: HATCH }}
                  className="rounded-t-md"
                />
              ) : null}
              {w.missed ? (
                <div
                  style={{
                    height: `${(w.missed / w.players) * 100}%`,
                    background: "rgb(var(--chart-owed))",
                  }}
                  className={w.skipped ? "" : "rounded-t-md"}
                />
              ) : null}
              {w.clean ? (
                <div
                  style={{
                    height: `${(w.clean / w.players) * 100}%`,
                    background: "rgb(var(--chart-clean))",
                  }}
                  className={w.skipped || w.missed ? "rounded-b-md" : "rounded-md"}
                />
              ) : null}
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-1.5">
          {weeks.map((w) => (
            <span key={w.week} className="flex-1 text-center text-[10px] text-ink-muted tnum">
              {w.week}
            </span>
          ))}
        </div>

        <ul className="flex flex-wrap gap-4 mt-3 text-xs text-ink-muted">
          {[
            ["Clean", "rgb(var(--chart-clean))"],
            ["Fined", "rgb(var(--chart-owed))"],
            ["Skip token", HATCH],
          ].map(([label, fill]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: fill }} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* 3 — what those weeks cost */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Fines billed each week
          </h4>
          <p className="text-sm text-ink-muted tnum" role="status">
            {hovered ? `Week ${hovered.week} — ${rupees(hovered.fined)}` : `Worst week ${rupees(maxFine)}`}
          </p>
        </div>

        <div
          className="flex gap-1 h-24 mt-3 items-end"
          onMouseLeave={() => setHoverWeek(null)}
          role="img"
          aria-label={`Fines billed each week, highest ${rupees(maxFine)}`}
        >
          {weeks.map((w) => (
            <div
              key={w.week}
              onMouseEnter={() => setHoverWeek(w.week)}
              onClick={() => setHoverWeek(w.week)}
              title={`Week ${w.week} — ${rupees(w.fined)}`}
              className="flex-1 h-full flex flex-col justify-end cursor-default"
            >
              <div
                className="rounded-t-md"
                style={{
                  height: `${Math.max(w.fined ? 3 : 0, (w.fined / maxFine) * 100)}%`,
                  background: "rgb(var(--chart-owed))",
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-1.5">
          {weeks.map((w) => (
            <span key={w.week} className="flex-1 text-center text-[10px] text-ink-muted tnum">
              {w.week}
            </span>
          ))}
        </div>
      </div>

      {/* 4 — how far the goals have actually moved */}
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
          Goal progress
        </h4>
        <p className="text-sm text-ink-muted mt-0.5">
          Each player's six points, weighted by how far each goal has come.
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
                  <span className="flex-1 h-2.5 rounded-full bg-paper-sunk overflow-hidden">
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

      {numbers ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Week by week, across the group</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 pr-4 font-semibold text-ink">Week</th>
                <th className="py-2 pr-4 font-semibold text-ink text-right">Clean</th>
                <th className="py-2 pr-4 font-semibold text-ink text-right">Fined</th>
                <th className="py-2 pr-4 font-semibold text-ink text-right">Skipped</th>
                <th className="py-2 font-semibold text-ink text-right">Billed</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week} className="border-b border-line-soft last:border-0">
                  <td className="py-2 pr-4 tnum text-ink">{w.week}</td>
                  <td className="py-2 pr-4 tnum text-right text-ink-muted">{w.clean}</td>
                  <td className="py-2 pr-4 tnum text-right text-ink-muted">{w.missed}</td>
                  <td className="py-2 pr-4 tnum text-right text-ink-muted">{w.skipped}</td>
                  <td className="py-2 tnum text-right text-ink">{rupees(w.fined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
};

export default GroupStats;
