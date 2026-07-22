import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_THEME_KEY,
  includedThemes,
  resolveThemeKey,
  shopThemes,
  themes,
} from "../src/themeCatalog.js";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

test("ships nineteen uniquely named included live themes", () => {
  const entries = Object.entries(includedThemes);
  const names = entries.map(([, theme]) => theme.name);

  assert.equal(entries.length, 19);
  assert.equal(new Set(names).size, entries.length);
});

test("ships 190 selectable Theme Shop variants", () => {
  const entries = Object.entries(shopThemes);
  assert.equal(entries.length, 190);
  assert.equal(Object.keys(themes).length, 209);
  assert.ok(entries.every(([, theme]) => theme.source === "TwinPath Theme Shop"));
  assert.ok(entries.every(([, theme]) => typeof theme.pack === "string" && theme.pack.length > 0));
});

test("every theme is included free and has complete scene metadata", () => {
  for (const [key, theme] of Object.entries(themes)) {
    assert.equal(theme.included, true, `${key} must be included free`);
    assert.match(theme.background, HEX_COLOR, `${key} background`);
    assert.match(theme.accent, HEX_COLOR, `${key} accent`);
    assert.match(theme.accent2, HEX_COLOR, `${key} secondary accent`);
    assert.equal(typeof theme.scene, "string", `${key} scene`);
    assert.ok(theme.scene.length > 0, `${key} scene`);
    assert.equal(typeof theme.description, "string", `${key} description`);
    assert.ok(theme.description.length >= 12, `${key} description`);
  }
});

test("falls back safely to Aurora Glass for invalid stored keys", () => {
  assert.equal(DEFAULT_THEME_KEY, "aurora");
  assert.equal(themes[DEFAULT_THEME_KEY].name, "Aurora Glass");
  assert.equal(resolveThemeKey("cyber"), "cyber");
  assert.equal(resolveThemeKey("missing-theme"), DEFAULT_THEME_KEY);
  assert.equal(resolveThemeKey(null), DEFAULT_THEME_KEY);
});
