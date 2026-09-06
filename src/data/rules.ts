/**
 * The FitBros 3.0 rules, as the group agreed them.
 *
 * Lifted from the shared rulebook circulated before Week 0, so the app and the
 * document cannot drift into saying different things. If a rule changes, it
 * changes in both places together.
 *
 * `ties` records which other rules a rule leans on — Rule 06 (fines) is only
 * legible next to Rule 05 (logging), and the app should let people follow that.
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
        "paragraphs": [],
        "points": [
          "Petition the group, set a meeting time",
          "Only people who attend get a vote",
          "Replacement worth the same points or more",
          "Tied vote → the original goal stands"
        ],
        "table": [],
        "ties": [
          "r1",
          "r2"
        ],
        "hasDefault": true
      }
    ]
  },
  {
    "name": "Week to week",
    "span": "Rule 05",
    "blurb": "What you do, and how it gets recorded. This is what decides whether a week is clean.",
    "rules": [
      {
        "id": "r5",
        "number": "05",
        "title": "Logging",
        "summary": "One shared sheet. A session is a workout, 10k steps is half.",
        "paragraphs": [
          "One sheet, single source of truth. A session counts if logged before your cutoff on the day you did it. Hevy, Strava, Apple Watch, Google Fit, timestamped photo — all accepted.",
          "Whatever you send counts as a workout. A 10k-step day counts as half of one, so two of them make a workout — and since a day is logged once, a week can never be walked clean.",
          "Your cutoff and week-end day come from Week 0, and the sheet is what the fine in Rule 06 is read off."
        ],
        "points": [
          "A session — anything you would call training — is 1",
          "A 10k-step day is ½, so two make a workout",
          "5 a week is clean, however you get there"
        ],
        "table": [],
        "ties": [
          "r3",
          "r7"
        ],
        "hasDefault": false
      }
    ]
  },
  {
    "name": "When you miss",
    "span": "Rules 06–07",
    "blurb": "A missed week costs money, and the price of a miss doubles if it keeps happening.",
    "rules": [
      {
        "id": "r7",
        "number": "06",
        "title": "Fines",
        "summary": "₹200 to start. Two strikes at a price, then it doubles.",
        "paragraphs": [
          "A miss costs ₹200. Two missed weeks at one price and the price doubles — and it keeps doubling, with no ceiling. Two clean weeks in a row halve it again."
        ],
        "points": [
          "2 missed weeks at one price → the price doubles",
          "2 clean weeks in a row → the price halves back down",
          "Charged on your own clock, paid within 48 hours"
        ],
        "table": [
          [
            "First two misses",
            "₹200"
          ],
          [
            "Next two",
            "₹400"
          ],
          [
            "Then",
            "₹800, ₹1,600, ₹3,200 …"
          ]
        ],
        "ties": [
          "r5",
          "r11",
          "r12"
        ],
        "hasDefault": false
      },
      {
        "id": "r10",
        "number": "07",
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
    "span": "Rules 08–09",
    "blurb": "Who takes the money, who takes the title, and who keeps the books all season.",
    "rules": [
      {
        "id": "r11",
        "number": "08",
        "title": "Winning",
        "summary": "Everyone with nothing owing splits the pot. Most goals wins the title.",
        "paragraphs": [],
        "points": [
          "The prize pot splits between everyone who ends the season with nothing left owing. A fined week doesn't cost you a share; it only costs you the fine.",
          "Challenge winner — most goals completed at target. Tiebreak: fewest fined weeks."
        ],
        "table": [],
        "ties": [
          "r7",
          "r10",
          "r2"
        ],
        "hasDefault": false
      },
      {
        "id": "r12",
        "number": "09",
        "title": "Admin",
        "summary": "Scorekeeper and Treasurer. Two people, both unassigned.",
        "paragraphs": [
          "Before Week 1, held by different people: Scorekeeper closes the sheet and posts fines, Treasurer holds the money."
        ],
        "points": [],
        "table": [],
        "ties": [
          "r5",
          "r7"
        ],
        "hasDefault": false
      }
    ]
  }
];

export const ALL_RULES: Rule[] = RULE_STAGES.flatMap((stage) => stage.rules);

