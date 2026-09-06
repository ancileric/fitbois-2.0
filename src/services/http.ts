/**
 * Every request states which player is making it.
 *
 * The server holds the caller to that id, so one player can't write to another's
 * record. It is an ownership check rather than authentication — see the note on
 * denyUnlessOwner in the server — and this is the single place a real token
 * would go once there is one.
 */

/**
 * In production the API is served from the same origin as the app, so a
 * relative path is right and a baked-in dev address (a LAN IP, say) is wrong.
 */
export const API_BASE =
  process.env.NODE_ENV === "production"
    ? "/api"
    : process.env.REACT_APP_API_URL || "http://localhost:5000/api";

/** Kept in localStorage by the player picker in the header. */
export const currentPlayerId = (): string | null => {
  try {
    return localStorage.getItem("playerId");
  } catch {
    return null;
  }
};

export const apiFetch = (path: string, init: RequestInit = {}): Promise<Response> => {
  const player = currentPlayerId();
  const headers = new Headers(init.headers);
  if (player) headers.set("x-player-id", player);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...init, headers });
};

/**
 * The newest reading for every goal, keyed by goal id.
 *
 * One request for the whole board — the per-goal route is still there, but
 * asking it once per goal cost a Turso round trip each.
 */
export const latestGoalReadings = async (): Promise<Record<string, number>> => {
  const res = await apiFetch("/goals/progress");
  if (!res.ok) return {};
  const byGoal: Record<string, { value: number }[]> = await res.json();
  return Object.fromEntries(
    Object.entries(byGoal)
      .filter(([, rows]) => rows.length > 0)
      .map(([goalId, rows]) => [goalId, rows[rows.length - 1].value])
  );
};
