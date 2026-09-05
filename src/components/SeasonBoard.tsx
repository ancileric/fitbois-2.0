import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, IndianRupee, RefreshCw, ShieldCheck, Ticket, Trophy } from "lucide-react";

/**
 * The FitBros 3.0 season board.
 *
 * Everything here is derived by the server from the workout sheet — the app
 * posts its own fines and works out its own standings, so this screen only
 * reports what the rules already decided.
 */

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const SEASON_WEEKS = 24;

type Standing = "active" | "suspended" | "out";

interface UnsettledFine {
  id: string;
  week: number;
  amount: number;
  dueAt: string;
  overdue: boolean;
}

interface SeasonBoardProps {
  /** Only the player themselves can spend one of their skip tokens. */
  currentUser: { id: string; name: string } | null;
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
  unsettledFines: UnsettledFine[];
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const STANDING_STYLE: Record<Standing, string> = {
  active: "bg-green-100 text-green-800",
  suspended: "bg-amber-100 text-amber-800",
  out: "bg-red-100 text-red-800",
};

const OUTCOME_STYLE = {
  clean: "bg-green-500",
  missed: "bg-red-500",
  skipped: "bg-amber-400",
} as const;

const SeasonBoard: React.FC<SeasonBoardProps> = ({ currentUser }) => {
  const [players, setPlayers] = useState<SeasonView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tokenNotice, setTokenNotice] = useState<string | null>(null);

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

  const syncFines = async () => {
    setBusy(true);
    try {
      await fetch(`${API}/fines/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  /**
   * Rule 09: appeal before the week starts, and the whole group approves.
   * The server re-checks all four constraints, so this is a request, not a grant.
   */
  const spendSkipToken = async (userId: string, week: number) => {
    setBusy(true);
    setTokenNotice(null);
    try {
      const res = await fetch(`${API}/skip-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, week, approvedBy: "group" }),
      });
      const body = await res.json();
      setTokenNotice(res.ok ? `Skip token approved for week ${week}.` : body.error);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const settle = async (fineId: string) => {
    setBusy(true);
    try {
      await fetch(`${API}/fines/${fineId}/settle`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading the season…</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <p className="font-semibold mb-1">{error}</p>
        <p className="text-sm">Start the API with <code>PORT=5000 node backend/server.js</code>, then retry.</p>
        <button onClick={load} className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm">
          Retry
        </button>
      </div>
    );
  }

  const pot = players.filter((p) => p.potEligible).length;
  const owed = players.reduce((sum, p) => sum + p.outstanding, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Season board</h2>
          <p className="text-sm text-gray-500">
            Week {players[0]?.currentWeek ?? 1} · {pot} of {players.length} still in for the pot ·{" "}
            {rupees(owed)} outstanding across the group
          </p>
        </div>
        <button
          onClick={syncFines}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
          Post due fines
        </button>
      </div>

      {tokenNotice ? (
        <div className="text-sm border border-gray-200 bg-white rounded-lg px-3 py-2 text-gray-800">
          {tokenNotice}
        </div>
      ) : null}

      {players.map((p) => (
        <div key={p.userId} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${STANDING_STYLE[p.standing]}`}>
                  {p.standing}
                </span>
                {p.potEligible ? (
                  <span className="flex items-center gap-1 text-xs text-green-700">
                    <Trophy size={13} /> in for the pot
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">no pot share</span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                A missed week costs <strong className="text-gray-900">{rupees(p.fineIfMissed)}</strong> ·{" "}
                {p.standing === "out"
                  ? "season over"
                  : p.priceLevel === 3
                  ? "already the highest price"
                  : `${3 - p.missesAtLevel} more miss${3 - p.missesAtLevel === 1 ? "" : "es"} and it goes up`}
              </p>
            </div>

            <div className="flex gap-4 text-right">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Owed</div>
                <div className={`text-lg font-bold ${p.outstanding ? "text-red-600" : "text-green-600"}`}>
                  {rupees(p.outstanding)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Paid</div>
                <div className="text-lg font-bold text-gray-900">{rupees(p.paid)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Skips</div>
                <div className="text-lg font-bold text-gray-900">{p.tokensLeft}</div>
              </div>
            </div>
          </div>

          {/* One block per completed week: green clean, red fined, amber skipped. */}
          <div className="flex gap-1 mb-3">
            {p.weeks.map((w) => (
              <div
                key={w.week}
                title={`Week ${w.week}: ${w.workouts} workouts, ${w.outcome}${w.fine ? ` (${rupees(w.fine)})` : ""}`}
                className={`h-7 flex-1 rounded ${OUTCOME_STYLE[w.outcome]}`}
              />
            ))}
          </div>

          {currentUser?.id === p.userId && p.standing !== "out" ? (
            <div className="border-t border-gray-100 pt-3 mb-1 flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">
                Next week is week {p.currentWeek + 1}.
              </span>
              <button
                onClick={() => spendSkipToken(p.userId, p.currentWeek + 1)}
                disabled={busy || p.tokensLeft === 0 || p.currentWeek + 1 > SEASON_WEEKS - 2}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 disabled:opacity-40"
              >
                <Ticket size={14} />
                Use a skip token ({p.tokensLeft} left)
              </button>
              {p.tokensLeft === 0 ? (
                <span className="text-xs text-gray-500">All three spent</span>
              ) : p.currentWeek + 1 > SEASON_WEEKS - 2 ? (
                <span className="text-xs text-gray-500">Not usable in the final two weeks</span>
              ) : null}
            </div>
          ) : null}

          {p.unsettledFines.length > 0 ? (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              {p.unsettledFines.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    {f.overdue ? (
                      <AlertTriangle size={15} className="text-red-500 shrink-0" />
                    ) : (
                      <IndianRupee size={15} className="text-amber-500 shrink-0" />
                    )}
                    <span className="text-gray-900 font-medium">
                      Week {f.week} — {rupees(f.amount)}
                    </span>
                    <span className={f.overdue ? "text-red-600" : "text-gray-500"}>
                      {f.overdue ? "past its 48 hours" : "due within 48 hours"}
                    </span>
                  </div>
                  <button
                    onClick={() => settle(f.id)}
                    disabled={busy || p.standing === "out"}
                    className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold disabled:opacity-40"
                  >
                    Mark paid
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-3 flex items-center gap-2 text-sm text-green-700">
              <ShieldCheck size={15} /> Nothing outstanding
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SeasonBoard;
