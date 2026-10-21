import test from "node:test";
import assert from "node:assert/strict";

import { classifyFeedHost, parseIcs, parseIcsDate, validateFeedInput } from "../src/calendar-feeds.js";

const NOW = Date.UTC(2026, 8, 2, 12, 0, 0); // 2026-09-02 12:00Z

const BLACKBOARD = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Blackboard//Learn//EN",
  "BEGIN:VTIMEZONE",
  "TZID:America/New_York",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "UID:course-101-lecture",
  "SUMMARY:ENG 120K Lecture",
  "LOCATION:Cornelia Hall 201",
  "DTSTART;TZID=America/New_York:20260824T090000",
  "DTEND;TZID=America/New_York:20260824T101500",
  "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261211T000000Z",
  "EXDATE;TZID=America/New_York:20260907T090000",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:assignment-7",
  "SUMMARY:Essay 1 due",
  "DESCRIPTION:Submit through the Blackboard drop box\\, PDF only.",
  "DTSTART;VALUE=DATE:20260915",
  "DTEND;VALUE=DATE:20260916",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:old-thing",
  "SUMMARY:Orientation",
  "DTSTART:20260801T140000Z",
  "DTEND:20260801T150000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const OUTLOOK = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "UID:040000008200E00074C5B7101A82E008",
  "SUMMARY:Advising appointment",
  "DTSTART;TZID=Eastern Standard Time:20260910T133000",
  "DTEND;TZID=Eastern Standard Time:20260910T140000",
  "LOCATION:Advising Center",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:cancelled-one",
  "SUMMARY:Cancelled meeting",
  "STATUS:CANCELLED",
  "DTSTART:20260911T130000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("classifies feed hosts", () => {
  assert.equal(classifyFeedHost("outlook.office365.com"), "outlook");
  assert.equal(classifyFeedHost("iona.blackboard.com"), "blackboard");
  assert.equal(classifyFeedHost("calendar.google.com"), "google");
  assert.equal(classifyFeedHost("example.org"), "other");
});

test("validates feed input", () => {
  assert.throws(() => validateFeedInput({ label: "x", url: "https://a.b/c.ics" }), /invalid_label|2-60/);
  assert.throws(() => validateFeedInput({ label: "Blackboard", url: "http://iona.blackboard.com/x.ics" }), /https/);
  assert.throws(() => validateFeedInput({ label: "Blackboard", url: "https://u:p@iona.blackboard.com/x.ics" }), /credentials/);
  assert.throws(() => validateFeedInput({ label: "Blackboard", url: "https://iona.blackboard.com/" }), /\.ics/);
  const ok = validateFeedInput({ label: " Blackboard ", url: "https://iona.blackboard.com/webapps/calendar/calendarFeed/abc/learn.ics" });
  assert.equal(ok.label, "Blackboard");
  assert.equal(ok.source, "blackboard");
  assert.equal(ok.visibility, "private");
});

test("parses dates in IANA, Windows and UTC forms", () => {
  // 09:00 New York on 24 Aug (EDT, UTC-4) is 13:00Z
  assert.equal(new Date(parseIcsDate("20260824T090000", { TZID: "America/New_York" }).ms).toISOString(), "2026-08-24T13:00:00.000Z");
  assert.equal(new Date(parseIcsDate("20260910T133000", { TZID: "Eastern Standard Time" }).ms).toISOString(), "2026-09-10T17:30:00.000Z");
  assert.equal(new Date(parseIcsDate("20260801T140000Z").ms).toISOString(), "2026-08-01T14:00:00.000Z");
  const d = parseIcsDate("20260915", { VALUE: "DATE" });
  assert.equal(d.allDay, true);
});

test("expands a Blackboard weekly class inside the window, honours EXDATE, drops the past", () => {
  const events = parseIcs(BLACKBOARD, { now: NOW });
  const lectures = events.filter((e) => e.title === "ENG 120K Lecture");
  // window: 1 Sep .. 1 Nov 2026 => Mon/Wed lectures, minus Labor Day (7 Sep)
  assert.ok(lectures.length >= 16 && lectures.length <= 18, `got ${lectures.length}`);
  assert.ok(!lectures.some((e) => e.starts_at.startsWith("2026-09-07")), "EXDATE removed Labor Day");
  assert.ok(lectures.every((e) => e.location === "Cornelia Hall 201"));
  assert.ok(lectures.every((e) => new Date(e.ends_at) - new Date(e.starts_at) === 75 * 60000));
  assert.ok(!events.some((e) => e.title === "Orientation"), "past event outside the window is dropped");
  const essay = events.find((e) => e.title === "Essay 1 due");
  assert.ok(essay && essay.all_day);
  assert.equal(essay.notes, "Submit through the Blackboard drop box, PDF only.");
  assert.ok(events.every((e) => e.external_uid.includes("|")));
});

test("Outlook feed: Windows time zone and cancelled events", () => {
  const events = parseIcs(OUTLOOK, { now: NOW });
  assert.equal(events.length, 1);
  assert.equal(events[0].title, "Advising appointment");
  assert.equal(events[0].starts_at, "2026-09-10T17:30:00.000Z");
  assert.equal(events[0].location, "Advising Center");
});
