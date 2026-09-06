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
    : process.env.REACT_APP_API_URL || "http://localhost:5050/api";

/**
 * The admin key.
 *
 * There is no login here, so the season's admin is whoever holds a shared
 * secret: open the app once as `?admin=<key>` and it is remembered on that
 * device. `?admin=` with nothing after it forgets it again. The key rides on
 * every request as x-admin-key, and the server is the thing that actually
 * enforces it — hiding the Admin tab is only tidiness.
 */
const ADMIN_KEY = "adminKey";

const claimAdminFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("admin")) return;
    const key = params.get("admin") || "";
    if (key) localStorage.setItem(ADMIN_KEY, key);
    else localStorage.removeItem(ADMIN_KEY);
    params.delete("admin");
    const query = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
  } catch {
    /* private mode, or no history API — the key just is not remembered */
  }
};

claimAdminFromUrl();

export const adminKey = (): string | null => {
  try {
    return localStorage.getItem(ADMIN_KEY);
  } catch {
    return null;
  }
};

export const isAdmin = (): boolean => Boolean(adminKey());

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
  const admin = adminKey();
  if (admin) headers.set("x-admin-key", admin);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...init, headers });
};

/** One logged reading, exactly as the server stores it. */
export interface Reading {
  id: string;
  value: number;
  note: string | null;
  recordedAt: string;
}

/**
 * Every reading for every goal, in time order, keyed by goal id.
 *
 * The whole history, not just the newest — the track is the point: a player
 * should see how many times they moved and how far each move took them. A
 * caller that only wants the latest takes the last of each array.
 *
 * One request for the whole board — the per-goal route is still there, but
 * asking it once per goal cost a Turso round trip each. The server has no
 * ?userId= filter, so one player cannot be asked for on its own.
 */
export const goalReadings = async (): Promise<Record<string, Reading[]>> => {
  const res = await apiFetch("/goals/progress");
  return res.ok ? await res.json() : {};
};
