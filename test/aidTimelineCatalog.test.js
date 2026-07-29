import assert from "node:assert/strict";
import test from "node:test";

import {
  actionState,
  actionTiming,
  actions,
  actionsForTrack,
  annualAtStake,
  daysBetween,
  tracks,
  valueLabel,
} from "../src/aidTimelineCatalog.js";

import { TWINS_EDD, TWINS_LIKELY_ARRIVAL } from "../src/twinsDates.js";

// A fixed "now" so these tests do not start failing on a calendar boundary.
const NOW = new Date(2026, 6, 29); // July 29, 2026

// The exact shape an action is allowed to have. This is the guard that keeps
// somebody from later adding a field that holds a birth weight, a case number,
// an SSN or an account balance. Actions describe what to do. They do not hold
// what you did.
const ALLOWED_KEYS = new Set([
  "id",
  "track",
  "trigger",
  "title",
  "do",
  "why",
  "value",
  "valueNote",
  "source",
  "url",
  "phone",
  "contact",
]);

// Anything that smells like stored personal data. Substring match, deliberately
// broad — a false positive here costs one rename, a false negative puts PHI in
// a git history.
const FORBIDDEN_KEY_FRAGMENTS = [
  "ssn",
  "mrn",
  "dob",
  "birthweight",
  "weight",
  "grams",
  "account",
  "balance",
  "card",
  "medicaid",
  "cin",
  "patient",
];

test("every action carries a citation", () => {
  for (const action of actions) {
    assert.equal(typeof action.source, "string", action.id + " has no source");
    assert.ok(action.source.length > 8, action.id + " has a stub source");
  }
});

test("action ids are unique", () => {
  const ids = actions.map((action) => action.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("actions expose no field that could hold personal data", () => {
  for (const action of actions) {
    for (const key of Object.keys(action)) {
      assert.ok(ALLOWED_KEYS.has(key), action.id + " has unexpected key: " + key);
      const flat = key.toLowerCase();
      for (const fragment of FORBIDDEN_KEY_FRAGMENTS) {
        assert.ok(
          !flat.includes(fragment),
          action.id + " key '" + key + "' looks like stored personal data",
        );
      }
    }
  }
});

test("every trigger is one of the three supported kinds", () => {
  for (const action of actions) {
    assert.ok(
      ["asap", "date", "birth"].includes(action.trigger.kind),
      action.id + " has an unknown trigger kind",
    );
    if (action.trigger.kind === "date") {
      assert.match(action.trigger.on, /^\d{4}-\d{2}-\d{2}$/, action.id + " has a malformed date");
      assert.ok(
        Number.isFinite(daysBetween(action.trigger.on, NOW)),
        action.id + " has an unparseable date",
      );
    } else {
      assert.equal(action.trigger.on, undefined, action.id + " should not carry a date");
    }
  }
});

test("every track referenced by an action exists in the rail", () => {
  const railIds = new Set(tracks.map((track) => track.id));
  for (const action of actions) {
    assert.ok(railIds.has(action.track), action.id + " points at an unknown track: " + action.track);
  }
});

test("actionState maps triggers to the states the CSS knows about", () => {
  assert.equal(actionState({ trigger: { kind: "asap" } }, NOW), "now");
  assert.equal(actionState({ trigger: { kind: "birth" } }, NOW), "birth");
  assert.equal(actionState({ trigger: { kind: "date", on: "2026-01-01" } }, NOW), "overdue");
  assert.equal(actionState({ trigger: { kind: "date", on: "2026-08-15" } }, NOW), "due");
  assert.equal(actionState({ trigger: { kind: "date", on: "2027-06-30" } }, NOW), "scheduled");
});

test("actionTiming never renders a bare number of days for a passed deadline", () => {
  const passed = actionTiming({ trigger: { kind: "date", on: "2026-01-01" } }, NOW);
  assert.match(passed, /^Passed /);
  assert.equal(actionTiming({ trigger: { kind: "asap" } }, NOW), "Start today");
  assert.equal(actionTiming({ trigger: { kind: "birth" } }, NOW), "When the twins arrive");
});

test("the birth filter returns exactly the birth-triggered actions", () => {
  const birthActions = actionsForTrack("birth", NOW);
  assert.ok(birthActions.length > 0);
  for (const action of birthActions) {
    assert.equal(action.trigger.kind, "birth");
  }
  const expected = actions.filter((action) => action.trigger.kind === "birth").length;
  assert.equal(birthActions.length, expected);
});

test("the all filter returns a copy, not the live array", () => {
  const all = actionsForTrack("all", NOW);
  assert.equal(all.length, actions.length);
  all.pop();
  assert.notEqual(all.length, actions.length);
});

test("annualAtStake counts only recurring dollars", () => {
  const list = [
    { value: { low: 1000, unit: "year" } },
    { value: { low: 500, unit: "once" } },
    { value: null },
    {},
  ];
  assert.equal(annualAtStake(list), 1000);
  assert.ok(annualAtStake() > 0, "the real catalog should have annual dollars on it");
});

test("valueLabel formats ranges and marks recurring amounts", () => {
  assert.equal(valueLabel({ value: { low: 7395, unit: "year" } }), "$7,395/yr");
  assert.equal(valueLabel({ value: { low: 3600, high: 5600, unit: "year" } }), "$3,600–$5,600/yr");
  assert.equal(valueLabel({ value: { low: 4657, unit: "once" } }), "$4,657");
  assert.equal(valueLabel({ value: null }), null);
  assert.equal(valueLabel(null), null);
});

test("every link is https and carries no tracking parameters", () => {
  for (const action of actions) {
    if (!action.url) continue;
    const url = new URL(action.url);
    assert.equal(url.protocol, "https:", action.id + " uses a non-https link");
    assert.equal(
      url.search,
      "",
      action.id + " carries query parameters — links here stay clean",
    );
  }
});

test("the twins dates are re-exported, not redeclared", async () => {
  const module = await import("../src/aidTimelineCatalog.js");
  assert.equal(module.TWINS_EDD, TWINS_EDD);
  assert.equal(module.TWINS_LIKELY_ARRIVAL, TWINS_LIKELY_ARRIVAL);
});

test("the FAFSA update action is anchored to the birth, not to a guessed date", () => {
  const update = actions.find((action) => action.id === "fafsa-update-at-birth");
  assert.ok(update, "the highest-value action is missing");
  assert.equal(update.trigger.kind, "birth");
  assert.match(update.source, /668\.55/);
});
