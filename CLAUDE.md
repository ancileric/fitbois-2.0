# FitBros 3.0

## How to communicate with Shreyes

These are standing rules for every response in this project. They do not lapse
when the topic changes or after a long session. If unsure whether they apply,
they do.

1. **Start every response with his first name.** "Shreyes — …".
2. **Lead with the next action.** A command, a path, a decision. Never a preamble,
   never "Let me…" or "Great question".
3. **Number multi-step work.** One bounded action per step. Cut steps he doesn't
   need rather than listing everything that happened.
4. **Cap lists at five.** Rank them. Five ranked beats ten unranked.
5. **Restate state every turn.** He can't hold "step 3 of 5" between messages.
6. **End with one concrete next action** — something doable in under two minutes.
7. **No recaps, no closing pleasantries.** No "Let me know if…", no "Hope this
   helps". Stop when the answer is done.
8. **Errors are matter-of-fact.** State cause and fix. Never "Uh oh" or "It seems".
9. **Terse prose.** Drop articles and filler where it doesn't cost clarity.
   Fragments are fine. Code, commits and security notes stay written normally.
10. **Long blocks of text do not get read.** If the explanation is longer than the
    change, delete the explanation.

Two plugins carry these rules and should stay on: `caveman` (terse prose) and
`i-have-adhd` (action-first shape). The ADHD plugin is user-invocation-only —
it cannot be started from inside a turn, so if its shape is missing, say so
plainly rather than imitating it.

Exceptions, where the task outranks the shape: he asks to "explain" or "walk me
through" (answer fully, still no preamble), a destructive action needs
confirmation, or he asks for options (give 2–4 ranked with trade-offs).

## What this project is

A 24-week fitness accountability season for a group of friends, with real money
attached. The rules are the product; the app only reports what the rules decide.

- **A clean week is 5 workouts.** Flat, for everyone.
- **A missed week costs money** — ₹500 → ₹1,000 → ₹2,000. Three misses at one
  price raise it; three clean weeks lower it.
- **Missing never eliminates you. Not paying does.** Active → Suspended (unpaid
  past 48h) → Out (two fines while suspended). No buy-backs.
- **The pot** splits between everyone still standing with nothing outstanding.
  A fined week does not cost you a share.
- **Goals:** 6 points across 2–6 goals, worth 3/2/1. Physical, numbered, provable.

## Architecture rules

- `src/utils/seasonEngine.js` is the single owner of the rules. The Express
  server requires the very same file the React app imports, so the API and UI
  can never disagree. It is plain CommonJS for that reason; types live in the
  sibling `.d.ts`.
- **Everything derived is replayed, never stored.** Price level, standing, fines
  and pot eligibility all come from replaying the workout sheet. There is no
  stored state to drift.
- **Fines are derived, then reconciled.** `syncFines` posts new ones and voids
  any whose week stopped being a miss.
- Writes carry `x-player-id` and the server holds the caller to it. That is an
  ownership check, not authentication.
- The season's current week comes from `admin_settings`, via `GET /api/settings`.
  Never recompute it from dates — that bug has been fixed twice.

## Working agreements

- Verify in the browser, not by assertion. A screenshot or a measured value, not
  "should work".
- Non-trivial logic leaves one runnable check behind (`npm test`).
- Run `npx tsc --noEmit` before saying something is done.
- Local dev: `nohup env PORT=5050 node backend/server.js &` and `npm start`.
  `node backend/scripts/seedFakeSeason.js` seeds nine players covering every
  state the rules can produce.
