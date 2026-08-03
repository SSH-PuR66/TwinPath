import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import {
  FLOW_CATALOG,
  PROFILE_SEED,
  activeSteps,
  flowById,
  pendingSteps,
  prefillCount,
  remainingMinutes,
  reviewAnswers,
} from "../src/flowCatalog.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(here, "..", "src", "flowCatalog.js");

const FORBIDDEN_FIELD_FRAGMENTS = [
  "ssn", "dob", "number", "acctnum", "routing", "card", "mask", "lastfour", "last4", "token", "password", "secret",
];

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

test("flow fields refuse sensitive identifier shapes", () => {
  for (const flow of FLOW_CATALOG) {
    for (const step of flow.steps) {
      for (const fragment of FORBIDDEN_FIELD_FRAGMENTS) {
        assert.equal(step.field.toLowerCase().includes(fragment), false, `${flow.id}.${step.field} includes ${fragment}`);
      }
    }
  }
});

test("the catalog only describes screens and never makes external requests", () => {
  const code = codeOnly(fs.readFileSync(catalogPath, "utf8"));
  assert.doesNotMatch(code, /\b(fetch|submit|post|axios|xmlhttprequest)\b/i);
});

test("ask-once removes prefilled fields from the rendered step list", () => {
  const flow = flowById("aid-moving");
  const profile = { ...PROFILE_SEED, student_name: "Sergio" };
  assert.equal(prefillCount(flow, profile), 4);
  assert.equal(activeSteps(flow, profile).length, 7);
  assert.equal(pendingSteps(flow, profile).some((step) => step.field === "student_name"), false);
  assert.equal(pendingSteps(flow, profile)[0].field, "student_birth_date");
});

test("progress and review keep skipped answers visible", () => {
  const flow = flowById("cut-bills");
  const profile = { ...PROFILE_SEED, benefit_coverage: "yes" };
  assert.equal(remainingMinutes(flow, profile), 0);
  const answers = reviewAnswers(flow, profile);
  assert.equal(answers.length, 2);
  assert.deepEqual(answers.map((answer) => answer.value), ["Optimum", "yes"]);
});

test("FlowRunner SSR skips a seeded first step and renders the full review", async () => {
  process.env.VITE_E2E_MOCK_AUTH = "1";
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { default: FlowRunner } = await vite.ssrLoadModule("/src/FlowRunner.jsx");
    const questionHtml = renderToStaticMarkup(React.createElement(FlowRunner, { householdId: "fixture", initialProfile: { student_name: "Sergio" }, initialFlowId: "aid-moving" }));
    assert.doesNotMatch(questionHtml, /What name should appear/);
    assert.match(questionHtml, /What is your birth date/);
    const seeded = {
      ...PROFILE_SEED,
      student_name: "Sergio",
      student_birth_date: "2007-01-01",
      student_address: "1 North Ave, New Rochelle, NY",
      contributor_email: "parent@example.test",
    };
    const reviewHtml = renderToStaticMarkup(React.createElement(FlowRunner, { householdId: "fixture", initialProfile: seeded, initialFlowId: "aid-moving", initialReview: true }));
    assert.match(reviewHtml, /Sergio/);
    assert.match(reviewHtml, /parent@example\.test/);
  } finally {
    await vite.close();
  }
});
