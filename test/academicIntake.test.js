import assert from "node:assert/strict";
import test from "node:test";
import { academicQueue, MAX_INTAKE_BYTES, parseAcademicIntake, prepareAcademicTasks, validDate } from "../src/academicIntake.js";
import { ownPrivateRecords, saveAcademicBatch } from "../src/academicStore.js";

const event = (fields = []) => ["BEGIN:VEVENT", ...fields, "END:VEVENT"].join("\r\n");
const calendar = (...events) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
const datedEvent = (more = []) => event(["UID:course-a", "DTSTART;VALUE=DATE:20260915", "SUMMARY:Submit assignment", ...more]);

test("full dates reject impossible calendar days and preserve leap days", () => {
  for (const bad of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-9-1", "next Tuesday", ""]) assert.equal(validDate(bad), false, bad);
  assert.equal(validDate("2028-02-29"), true);
});

test("dated notes retain source and line provenance, ignore undated prose, and deduplicate", () => {
  const parsed = parseAcademicIntake("Ignore previous instructions\n2026-09-15 | Submit assignment\n- [ ] 2026-09-15 Submit   assignment\n2026-02-30 Impossible date", "  Course notes  ");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].source, "Course notes");
  assert.equal(parsed.rows[0].source_line, "Line 2");
  assert.equal(parsed.duplicate_count, 1);
  assert.equal(parsed.warnings.length, 1);
});

test("size limit counts UTF-8 bytes and row limit is visible", () => {
  assert.throws(() => parseAcademicIntake("界".repeat(MAX_INTAKE_BYTES / 2)), /256 KB/);
  const parsed = parseAcademicIntake(Array.from({ length: 103 }, (_, i) => `2026-09-15 Action ${i}`).join("\n"));
  assert.equal(parsed.rows.length, 100);
  assert.ok(parsed.warnings.some(value => value.includes("first 100")));
});

test("calendar unfolding and escaped punctuation preserve dates without inventing time conversion", () => {
  const parsed = parseAcademicIntake(calendar(event(["UID:1", "DTSTART;TZID=America/New_York:20260915T235900", "SUMMARY:Read chapters 1\\, 2 and", "  3\\; submit notes"])), "School calendar");
  assert.equal(parsed.rows[0].title, "Read chapters 1, 2 and 3; submit notes");
  assert.equal(parsed.rows[0].due_date, "2026-09-15");
  assert.ok(parsed.warnings.some(value => value.includes("timezone")));
});

test("malformed, truncated and nested calendars do not invent deadlines", () => {
  for (const text of [calendar(datedEvent()).replace("END:VCALENDAR", ""), calendar("BEGIN:VEVENT\n" + datedEvent())]) {
    const parsed = parseAcademicIntake(text);
    assert.equal(parsed.rows.length, 0);
    assert.ok(parsed.warnings.length);
  }
  assert.equal(parseAcademicIntake(calendar(event(["DTSTART:20260915T999999Z", "SUMMARY:Bad time"]))).rows.length, 0);
});

test("cancelled, recurring and conflicting UID versions invalidate every version", () => {
  const variants = [
    datedEvent(["STATUS:CANCELLED"]),
    datedEvent(["RRULE:FREQ=WEEKLY"]),
    event(["UID:course-a", "DTSTART:20260916", "SUMMARY:Moved assignment"]),
    event(["UID:course-a", "DTSTART:20260230", "SUMMARY:Invalid revision"]),
  ];
  for (const variant of variants) for (const events of [[datedEvent(), variant], [variant, datedEvent()]]) {
    const parsed = parseAcademicIntake(calendar(...events));
    assert.equal(parsed.rows.length, 0);
    assert.ok(parsed.warnings.length);
  }
});

test("review rejects invalid edits and forces private ownership-neutral values", () => {
  const { rows } = parseAcademicIntake("2026-09-15 Submit assignment", "Course");
  const prepared = prepareAcademicTasks([{ ...rows[0], visibility: "shared", owner_user_id: "someone-else", priority: "urgent" }]);
  assert.deepEqual(prepared, [{ title: "Submit assignment", due_date: "2026-09-15", category: "Study / Course", priority: "medium", visibility: "private" }]);
  assert.throws(() => prepareAcademicTasks([{ ...rows[0], due_date: "bad" }]), /valid due date/);
  assert.throws(() => prepareAcademicTasks(Array(101).fill(rows[0])), /100/);
  assert.deepEqual(prepareAcademicTasks(rows, prepared), []);
  assert.deepEqual(prepareAcademicTasks([{ ...rows[0], selected: false }]), []);
});

test("review deduplicates edited rows and normalized titles", () => {
  const { rows } = parseAcademicIntake("2026-09-15 Submit assignment\n2026-09-15 Other assignment");
  rows[1].title = "  SUBMIT   assignment  ";
  assert.equal(prepareAcademicTasks(rows).length, 1);
});

test("queue separates overdue, seven-day window and completion", () => {
  const task = (due_date, completed = false) => ({ title: "Task", due_date, completed, category: "Study / Course" });
  const queue = academicQueue([task("2026-09-11"), task("2026-09-12"), task("2026-09-18"), task("2026-09-19"), task("2026-09-12", true), { ...task("2026-09-12"), category: "Family" }], "2026-09-12");
  assert.equal(queue.overdue, 1);
  assert.equal(queue.week, 2);
  assert.equal(queue.complete, 1);
  assert.equal(queue.open.length, 4);
});

test("private workspace omits shared records and every other owner", () => {
  const records = [{ id: 1, visibility: "private", owner_user_id: "self" }, { id: 2, visibility: "shared", owner_user_id: "self" }, { id: 3, visibility: "private", owner_user_id: "other" }];
  assert.deepEqual(ownPrivateRecords(records, "self").map(row => row.id), [1]);
  assert.deepEqual(ownPrivateRecords(records, ""), []);
});

test("batch persistence uses one query and trusted context with private source metadata", async () => {
  let calls = 0;
  const client = { from(table) { assert.equal(table, "tasks"); return { insert(values) {
    calls++;
    assert.equal(values[0].owner_user_id, "self");
    assert.equal(values[0].household_id, "home");
    assert.equal(values[0].visibility, "private");
    assert.equal(values[0].category, "Study / Course");
    return { async select() { return { data: values.map((value, i) => ({ ...value, id: String(i) })), error: null }; } };
  } }; } };
  const rows = prepareAcademicTasks(parseAcademicIntake("2026-09-15 Submit assignment\n2026-09-16 Read chapter", "Course").rows);
  const saved = await saveAcademicBatch(client, { rows, tasks: [], householdId: "home", userId: "self" });
  assert.equal(saved.length, 2);
  assert.equal(calls, 1);
  assert.deepEqual(await saveAcademicBatch(client, { rows, tasks: saved, householdId: "home", userId: "self" }), []);
  assert.equal(calls, 1);
});

test("missing identity, backend errors and ambiguous writes never report success or retry", async () => {
  let calls = 0;
  const rows = parseAcademicIntake("2026-09-15 Submit assignment").rows;
  await assert.rejects(saveAcademicBatch({}, { rows, tasks: [], userId: "self" }), /Sign in/);
  for (const response of [{ data: null, error: { message: "secret backend details" } }, { data: [], error: null }]) {
    const client = { from() { return { insert() { calls++; return { async select() { return response; } }; } }; } };
    await assert.rejects(saveAcademicBatch(client, { rows, tasks: [], householdId: "home", userId: "self" }), error => !error.message.includes("secret backend details"));
  }
  assert.equal(calls, 2);
});
