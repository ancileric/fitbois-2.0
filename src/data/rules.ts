/**
 * The FitBros 3.0 rules, as the group agreed them.
 *
 * Lifted from the shared rulebook circulated before Week 0, so the app and the
 * document cannot drift into saying different things. If a rule changes, it
 * changes in both places together.
 *
 * `ties` records which other rules a rule leans on — Rule 07 (fines) is only
 * legible next to Rule 08 (standing), and the app should let people follow that.
 */

export interface Rule {
  id: string;
  number: string;
  title: string;
  /** One line, for scanning. */
  summary: string;
  paragraphs: string[];
  points: string[];
  /** Rows of a small table, where the rule has one (prices, tiers). */
  table: string[][];
  /** Ids of the rules this one depends on. */
  ties: string[];
  /** The group took a suggested default here and may revisit it. */
  hasDefault: boolean;
}

export interface RuleStage {
  name: string;
  span: string;
  blurb: string;
  rules: Rule[];
}

export const RULE_STAGES: RuleStage[] = [
  {
    "name": "Before you start",
    "span": "Rules 01–04",
    "blurb": "Everyone agrees what counts, what it's worth, and when your week ends.",
    "rules": [
      {
        "id": "r1",
        "number": "01",
        "title": "Goals",
        "summary": "Physical, numbered, provable. Nothing you eat or sleep.",
        "paragraphs": [
          "Your own categories, no fixed slots. Every goal passes three tests: physical output (training, not intake), measured by a number (reps, kg, minutes, sessions, distance, time), provable (app log, timestamp, photo).",
          "Bodyweight isn't a goal. It's a state, not an output, and it's personal rather than group business. Train right and it follows."
        ],
        "points": [],
        "table": [],
        "ties": [
          "r2",
          "r3",
          "r4"
        ],
        "hasDefault": false
      },
      {
        "id": "r2",
        "number": "02",
        "title": "Points",
        "summary": "6 points each, split across 2 to 6 goals.",
        "paragraphs": [
          "Spend all 6. Nobody runs an easier season than anyone else."
        ],
        "points": [],
        "table": [
          [
            "Heavy",
            "3"
          ],
          [
            "Medium",
            "2"
          ],
          [
            "Light",
            "1"
          ]
        ],
        "ties": [
          "r1",
          "r3",
          "r4",
          "r11"
        ],
        "hasDefault": false
      },
      {
        "id": "r3",
        "number": "03",
        "title": "Week 0",
        "summary": "Goals approved, baselines recorded, clocks locked.",
        "paragraphs": [
          "Everyone assembles, posts goals with point values, group signs off. A goal is live once approved.",
          "Cutoff and week-end day are fixed for the season."
        ],
        "points": [
          "Baselines — video of the lift, current time, current max",
          "Daily cutoff — the hour your day rolls over",
          "Week-end day"
        ],
        "table": [],
        "ties": [
          "r1",
          "r2",
          "r5",
          "r12"
        ],
        "hasDefault": false
      },
      {
        "id": "r4",
        "number": "04",
        "title": "Changing a goal",
        "summary": "Only once you've completed it. Group votes.",
        "paragraphs": [
          "Suspended players can't petition — see Rule 08."
        ],
        "points": [
          "Petition the group, set a meeting time",
          "Only people who attend get a vote",
          "Replacement worth the same points or more",
          "Tied vote → the original goal stands"
        ],
        "table": [],
        "ties": [
          "r1",
          "r2",
          "r8"
        ],
        "hasDefault": true
      }
    ]
  },
  {
    "name": "Week to week",
    "span": "Rules 05–06",
    "blurb": "What you do, and how it gets recorded. This is what decides whether a week is clean.",
    "rules": [
      {
        "id": "r5",
        "number": "05",
        "title": "Logging",
        "summary": "One shared sheet, logged before your own cutoff.",
        "paragraphs": [
          "One sheet, single source of truth. A session counts if logged before your cutoff on the day you did it. Hevy, Strava, Apple Watch, Google Fit, timestamped photo — all accepted.",
          "Your cutoff and week-end day come from Week 0, and the sheet is what the fine in Rule 07 is read off."
        ],
        "points": [],
        "table": [],
        "ties": [
          "r3",
          "r6",
          "r7"
        ],
        "hasDefault": false
      },
      {
        "id": "r6",
        "number": "06",
        "title": "Swaps",
        "summary": "Set the week once. One swap a week, before the day starts.",
        "paragraphs": [
          "Commit the days you plan to train. The week you are in can be planned once; after that the plan stands, and the swap is the only way to move a day. Weeks that have not started yet can be rewritten freely.",
          "Substitute one session for an equivalent. Before the day starts, never after. You can opt out of the scheduling system entirely and just not use swaps."
        ],
        "points": [],
        "table": [],
        "ties": [
          "r5",
          "r3"
        ],
        "hasDefault": false
      }
    ]
  },
  {
    "name": "When you miss",
    "span": "Rules 07–10",
    "blurb": "A missed week costs money, the price rises if it keeps happening, and not paying is worse than missing.",
    "rules": [
      {
        "id": "r7",
        "number": "07",
        "title": "Fines",
        "summary": "₹500, ₹1,000, ₹2,000 — miss repeatedly and the price goes up.",
        "paragraphs": [],
        "points": [
          "3 missed weeks at one price → the price goes up a level",
          "3 clean weeks in a row → the price drops back down",
          "Charged on your own clock, paid within 48 hours"
        ],
        "table": [
          [
            "Level 1",
            "₹500"
          ],
          [
            "Level 2",
            "₹1,000"
          ],
          [
            "Level 3",
            "₹2,000"
          ]
        ],
        "ties": [
          "r5",
          "r8",
          "r9",
          "r11",
          "r12"
        ],
        "hasDefault": false
      },
      {
        "id": "r8",
        "number": "08",
        "title": "Standing",
        "summary": "Unpaid past 48h → suspended. Two more fines → out.",
        "paragraphs": [
          "Suspended — a fine unpaid past 48 hours. You keep logging, goals stay locked as approved, no petitions , and no prize money until you clear it. Pay up and you're Active again; your price level does not reset.",
          "Paying puts you all the way back. Clearing what you owe restores your standing and your share of the pot. A fined week costs you the fine and nothing else — only elimination is permanent.",
          "Out — two fines accumulated while suspended. Everything you've paid stays in the prize pot. No buy-backs."
        ],
        "points": [],
        "table": [],
        "ties": [
          "r7",
          "r4",
          "r11",
          "r12"
        ],
        "hasDefault": true
      },
      {
        "id": "r9",
        "number": "09",
        "title": "Skip tokens",
        "summary": "3 a season. Never 3 in a row, never in the last two weeks.",
        "paragraphs": [
          "Each token cancels one week's fine. The price level doesn't move, and the week costs you nothing.",
          "Tokens are for genuine unavoidable situations — agree on that spirit at Week 0."
        ],
        "points": [
          "Appeal before your week starts",
          "Whole group approves",
          "Maximum two consecutive"
        ],
        "table": [],
        "ties": [
          "r7",
          "r3",
          "r11"
        ],
        "hasDefault": false
      },
      {
        "id": "r10",
        "number": "10",
        "title": "Injury",
        "summary": "Solid proof → full refund and exit.",
        "paragraphs": [
          "Verified injury with solid proof: full refund, exit from the season, paid out of the prize pot. No proof, no claim."
        ],
        "points": [],
        "table": [],
        "ties": [
          "r11"
        ],
        "hasDefault": false
      }
    ]
  },
  {
    "name": "How it ends",
    "span": "Rules 11–12",
    "blurb": "Who takes the money, who takes the title, and who keeps the books all season.",
    "rules": [
      {
        "id": "r11",
        "number": "11",
        "title": "Winning",
        "summary": "Everyone still standing splits the pot. Most goals wins the title.",
        "paragraphs": [],
        "points": [
          "The prize pot splits between everyone still standing at the end — anyone not eliminated, with nothing left owing. Fined weeks don't cost you a share; they only cost you the fine.",
          "If everyone gets eliminated, nobody takes the pot and the money funds a group tiebreaker celebration instead.",
          "Challenge winner — most goals completed at target. Tiebreak: fewest fined weeks."
        ],
        "table": [],
        "ties": [
          "r7",
          "r8",
          "r9",
          "r10",
          "r2"
        ],
        "hasDefault": false
      },
      {
        "id": "r12",
        "number": "12",
        "title": "Admin",
        "summary": "Scorekeeper and Treasurer. Two people, both unassigned.",
        "paragraphs": [
          "Before Week 1, held by different people: Scorekeeper closes the sheet and posts fines, Treasurer holds the money."
        ],
        "points": [],
        "table": [],
        "ties": [
          "r5",
          "r7",
          "r8"
        ],
        "hasDefault": false
      }
    ]
  }
];

export const ALL_RULES: Rule[] = RULE_STAGES.flatMap((stage) => stage.rules);

