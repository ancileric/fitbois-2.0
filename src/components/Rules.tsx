import React, { useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { ALL_RULES, RULE_STAGES } from "../data/rules";
import { fineAtLevel, SEASON_WEEKS, WORKOUTS_PER_WEEK } from "../utils/seasonEngine";

/**
 * The rules, in the app, so nobody has to go looking for the document.
 *
 * Same text the group agreed before Week 0 (src/data/rules.ts), arranged the way
 * the season actually unfolds: what you agree first, what you do weekly, what a
 * miss costs, how it ends.
 */

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** The handful of numbers people ask about, straight from the engine. */
const HEADLINES: [string, string][] = [
  ["A clean week", `${WORKOUTS_PER_WEEK} workouts`],
  ["10k steps", "half a workout"],
  ["A missed week", `from ${rupees(fineAtLevel(1))}, doubling`],
  ["Season", `${SEASON_WEEKS} weeks`],
];

const Rules: React.FC = () => {
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const titleOf = useMemo(
    () => Object.fromEntries(ALL_RULES.map((r) => [r.id, `${r.number} ${r.title}`])),
    []
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    return new Set(
      ALL_RULES.filter((rule) =>
        [rule.title, rule.summary, ...rule.paragraphs, ...rule.points]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      ).map((r) => r.id)
    );
  }, [query]);

  /** Following a tie opens the rule it points at and brings it into view. */
  const jumpTo = (id: string) => {
    setQuery("");
    setOpen(id);
    requestAnimationFrame(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="display text-3xl">The rules</h2>
        <p className="text-sm text-ink-muted mt-1 max-w-[60ch]">
          What the group agreed before Week 0. Four stages, in the order the season runs.
        </p>

        <dl className="grid grid-cols-2 lg:grid-cols-4 border-t border-line mt-5 sm:divide-x divide-line">
          {HEADLINES.map(([label, value]) => (
            <div key={label} className="py-4 pr-4 sm:px-4 sm:first:pl-0 border-b border-line">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{label}</dt>
              <dd className="display text-2xl tnum mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="relative mt-5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the rules — fine, goal, pot…"
            aria-label="Search the rules"
            className="w-full min-h-[44px] pl-10 pr-3 border border-line rounded-xl text-sm bg-paper-card
                       focus:ring-2 focus:ring-clean-500 focus:border-clean-500"
          />
        </div>
        {matches ? (
          <p className="text-sm text-ink-muted mt-2" role="status">
            {matches.size} rule{matches.size === 1 ? "" : "s"} mention “{query.trim()}”
          </p>
        ) : null}
      </header>

      {RULE_STAGES.map((stage) => {
        const visible = stage.rules.filter((rule) => !matches || matches.has(rule.id));
        if (!visible.length) return null;

        return (
          <section key={stage.name}>
            <div className="border-t-2 border-ink pt-3">
              <h3 className="display text-2xl flex items-baseline gap-3 flex-wrap">
                {stage.name}
                <span className="font-mono text-xs font-normal normal-case tracking-normal text-ink-muted">
                  {stage.span}
                </span>
              </h3>
              <p className="text-sm text-ink-muted mt-1 max-w-[64ch]">{stage.blurb}</p>
            </div>

            <div className="mt-2">
              {visible.map((rule) => {
                const isOpen = open === rule.id;
                return (
                  <div
                    key={rule.id}
                    ref={(el) => {
                      cardRefs.current[rule.id] = el;
                    }}
                    className="border-b border-line"
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : rule.id)}
                      aria-expanded={isOpen}
                      className="w-full text-left py-4 grid grid-cols-[2.1rem_1fr_1.25rem] gap-x-1 items-start cursor-pointer"
                    >
                      <span className="font-mono text-sm text-ink-muted tnum pt-1">{rule.number}</span>
                      <span>
                        <span className="display text-xl block">{rule.title}</span>
                        <span className="text-sm text-ink-muted block mt-0.5">{rule.summary}</span>
                      </span>
                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className={`text-ink-muted mt-1.5 justify-self-end transition-transform duration-200 ease-settle ${
                          isOpen ? "rotate-180 text-clean-600" : ""
                        }`}
                      />
                    </button>

                    {isOpen ? (
                      <div className="pb-5 pl-[2.1rem] text-sm leading-relaxed space-y-3">
                        {rule.paragraphs.map((paragraph) => (
                          <p key={paragraph} className="max-w-[68ch]">
                            {paragraph}
                          </p>
                        ))}

                        {rule.points.length ? (
                          <ul className="space-y-1.5 max-w-[68ch]">
                            {rule.points.map((point) => (
                              <li key={point} className="flex gap-2">
                                <span className="text-clean-600 shrink-0" aria-hidden="true">
                                  •
                                </span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {rule.table.length ? (
                          <table className="text-sm border-y border-line">
                            <tbody>
                              {rule.table.map((row) => (
                                <tr key={row.join()} className="border-b border-line-soft last:border-0">
                                  {row.map((cell, i) => (
                                    <td
                                      key={cell + i}
                                      className={`py-2 pr-8 ${i === row.length - 1 ? "font-mono tnum text-ink" : "text-ink-muted"}`}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : null}

                        {rule.hasDefault ? (
                          <p className="text-xs text-skip-600 bg-skip-50 rounded-lg px-3 py-2 max-w-[68ch]">
                            This one took a suggested default. Say so at Week 0 if the group wants it
                            different.
                          </p>
                        ) : null}

                        {rule.ties.length ? (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted mr-1">
                              Ties into
                            </span>
                            {rule.ties.map((tie) => (
                              <button
                                key={tie}
                                onClick={() => jumpTo(tie)}
                                className="font-mono text-xs border border-line rounded-lg px-2 py-1 text-ink-muted
                                           cursor-pointer transition-colors duration-150 ease-settle
                                           hover:border-clean-500 hover:text-clean-600"
                              >
                                {titleOf[tie] ?? tie}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="text-xs text-ink-muted border-t border-line pt-4 max-w-[68ch]">
        The season assumes {SEASON_WEEKS} weeks, and that the miss count resets whenever the price
        of a miss changes.
      </p>
    </div>
  );
};

export default Rules;
