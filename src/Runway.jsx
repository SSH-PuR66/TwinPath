import React, { useMemo } from "react";

import { TWINS_EDD, TWINS_LIKELY_ARRIVAL } from "./twinsDates";

const MS_PER_DAY = 86400000;
const GESTATION_WEEKS = 40;

/** Midday local time keeps a date-only ISO string on its intended calendar day. */
function atMidday(isoDate) {
  return new Date(`${isoDate}T12:00:00`);
}

function weeksBetween(from, to) {
  return Math.round((to - from) / (MS_PER_DAY * 7));
}

/**
 * The countdown, drawn as the whole window rather than a single number.
 *
 * TwinPath tracks two dates that are deliberately not interchangeable: the due
 * date the OB put in writing, and the earlier date to plan against because twin
 * gestation runs ~35.2 weeks. They sit about a month apart. A lone "N days
 * until" headline hides that month, which is exactly the part that changes what
 * you should be doing this week -- so the runway shows it.
 */
export default function Runway({ now = new Date() }) {
  const model = useMemo(() => {
    const target = atMidday(TWINS_LIKELY_ARRIVAL);
    const due = atMidday(TWINS_EDD);

    const daysToTarget = Math.max(0, Math.ceil((target - now) / MS_PER_DAY));
    const weeksToTarget = Math.max(0, Math.ceil(daysToTarget / 7));
    const windowWeeks = Math.max(0, weeksBetween(target, due));

    // The track spans a full gestation so early weeks read as progress already
    // banked, not empty space.
    const remaining = Math.min(weeksToTarget, GESTATION_WEEKS);
    const elapsed = Math.max(0, GESTATION_WEEKS - remaining - windowWeeks);

    const weeks = [];
    for (let i = 0; i < elapsed; i += 1) weeks.push("done");
    weeks.push("now");
    for (let i = 1; i < remaining; i += 1) weeks.push("ahead");
    for (let i = 0; i < windowWeeks; i += 1) weeks.push("window");

    return { daysToTarget, weeksToTarget, windowWeeks, weeks, target, due };
  }, [now]);

  const dateLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="runway">
      <p className="runway__figures">
        <span className="runway__count">{model.weeksToTarget}</span>
        <span className="runway__unit">
          {model.weeksToTarget === 1 ? "week to plan with" : "weeks to plan with"}
        </span>
      </p>

      <ol
        className="runway__track"
        aria-label={`${model.weeksToTarget} weeks until the planning target, then a ${model.windowWeeks} week window before the written due date`}
      >
        {model.weeks.map((state, index) => (
          <li
            key={index}
            className={
              "runway__week" +
              (state === "done" ? " is-done" : "") +
              (state === "now" ? " is-now" : "") +
              (state === "window" ? " is-window" : "")
            }
          />
        ))}
      </ol>

      <dl className="runway__legend">
        <div>
          <dt>
            <span className="runway__swatch" aria-hidden="true" />
            Plan for
          </dt>
          <dd>{dateLabel.format(model.target)}</dd>
        </div>
        <div>
          <dt>
            <span className="runway__swatch is-window" aria-hidden="true" />
            Due date
          </dt>
          <dd>{dateLabel.format(model.due)}</dd>
        </div>
      </dl>

      <p className="runway__note">
        Twins usually come early. The hatched weeks are your margin.
      </p>
    </div>
  );
}
