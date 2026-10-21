// Deterministic, browser-local intake. Documents are data, never instructions.
export const MAX_INTAKE_BYTES = 256 * 1024;
export const MAX_INTAKE_ROWS = 100;

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function taskIdentity(task) {
  return `${String(task.title || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()}|${task.due_date || ""}`;
}

function cleanText(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function calendarText(value) {
  return value.replace(/\\[nN]/g, " ").replace(/\\([,;\\])/g, "$1");
}

function parseCalendar(text) {
  const warnings = [];
  const candidates = [];
  const seen = new Map();
  const conflicts = new Set();
  let fields = null;
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n[ \t]|\n[ \t]/g, "").trim().split(/\r?\n/);
  if (lines[0]?.toUpperCase() !== "BEGIN:VCALENDAR" || lines.at(-1)?.toUpperCase() !== "END:VCALENDAR"
      || lines.filter(line => line.toUpperCase() === "BEGIN:VCALENDAR").length !== 1) {
    return { rows: [], warnings: ["The calendar is incomplete or contains multiple calendars. Export a complete calendar before importing."] };
  }
  for (const line of lines) {
    if (line.toUpperCase() === "BEGIN:VEVENT") {
      if (fields) return { rows: [], warnings: ["The calendar contains nested events. Export it again before importing."] };
      fields = {}; continue;
    }
    if (!fields) continue;
    if (line.toUpperCase() === "END:VEVENT") {
      const event = fields;
      fields = null;
      if (event.STATUS?.toUpperCase() === "CANCELLED") {
        if (event.UID) conflicts.add(event.UID);
        warnings.push("A cancelled calendar event was excluded."); continue;
      }
      if (event.RRULE || event.RDATE || event["RECURRENCE-ID"]) {
        if (event.UID) conflicts.add(event.UID);
        warnings.push("A recurring event was excluded. Export individual deadlines or add them manually.");
        continue;
      }
      const rawDate = event.DTSTART || "";
      const match = rawDate.match(/^(\d{4})(\d{2})(\d{2})(?:T(?:[01]\d|2[0-3])[0-5]\d[0-5]\dZ?)?$/);
      const date = match ? `${match[1]}-${match[2]}-${match[3]}` : "";
      const title = cleanText(calendarText(event.SUMMARY || ""));
      if (!validDate(date) || !title || title.length > 180) {
        if (event.UID) conflicts.add(event.UID);
        warnings.push("A calendar event needs a valid start date and a title of 180 characters or fewer.");
        continue;
      }
      const row = { title, due_date: date, source_line: "Calendar event", kind: "Calendar" };
      if (event.UID) {
        const prior = seen.get(event.UID);
        if (prior && taskIdentity(prior) !== taskIdentity(row)) conflicts.add(event.UID);
        else if (!prior) { seen.set(event.UID, row); candidates.push({ ...row, uid: event.UID }); }
      } else candidates.push(row);
      if (rawDate.includes("T")) warnings.push("Calendar times become dates as written in the source. Check the date against your university timezone.");
      continue;
    }
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).split(";", 1)[0].toUpperCase();
    if (["SUMMARY", "DTSTART", "UID", "RRULE", "RDATE", "RECURRENCE-ID", "STATUS"].includes(name)) {
      if (Object.hasOwn(fields, name)) fields.RRULE = "ambiguous";
      else fields[name] = line.slice(colon + 1);
    }
  }
  if (fields) {
    if (fields.UID) conflicts.add(fields.UID);
    warnings.push("An unfinished calendar event was excluded.");
  }
  if (conflicts.size) warnings.push("Conflicting versions of a calendar event were excluded. Check the original calendar.");
  return { rows: candidates.filter(row => !conflicts.has(row.uid)).map(({ uid, ...row }) => row), warnings };
}

export function parseAcademicIntake(text, sourceName = "Pasted notes") {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_INTAKE_BYTES) {
    throw new Error("Use a text or calendar file no larger than 256 KB.");
  }
  const source = cleanText(sourceName).slice(0, 120) || "Pasted notes";
  let parsed;
  if (/BEGIN:VCALENDAR/i.test(text)) parsed = parseCalendar(text);
  else {
    const warnings = [];
    const rows = [];
    text.split(/\r?\n/).forEach((line, index) => {
      const match = line.match(/^\s*(?:[-*]\s*(?:\[[ xX]\]\s*)?)?(\d{4}-\d{2}-\d{2})\s*(?:[|:]|[-–—])?\s+(.+)$/);
      if (!match) return;
      const title = cleanText(match[2]);
      if (!validDate(match[1]) || !title || title.length > 180) {
        warnings.push(`Line ${index + 1} needs a valid date and a title of 180 characters or fewer.`);
        return;
      }
      rows.push({ title, due_date: match[1], source_line: `Line ${index + 1}`, kind: "Notes" });
    });
    parsed = { rows, warnings };
  }
  const unique = new Map();
  for (const row of parsed.rows) if (!unique.has(taskIdentity(row))) unique.set(taskIdentity(row), row);
  const rows = [...unique.values()].slice(0, MAX_INTAKE_ROWS).map((row, index) => ({ ...row, source, id: `intake-${index}`, selected: true }));
  if (unique.size > MAX_INTAKE_ROWS) parsed.warnings.push("Only the first 100 unique actions are included. Split larger files before importing.");
  if (!rows.length) parsed.warnings.push("No dated actions found. Paste one action per line, starting with YYYY-MM-DD, or import an .ics calendar.");
  return { source, rows, warnings: [...new Set(parsed.warnings)], duplicate_count: parsed.rows.length - unique.size };
}

export function prepareAcademicTasks(rows, existingTasks = []) {
  if (!Array.isArray(rows) || rows.length > MAX_INTAKE_ROWS) throw new Error("Save at most 100 reviewed actions at a time.");
  const existing = new Set(existingTasks.map(taskIdentity));
  const result = [];
  for (const row of rows) {
    if (!row.selected) continue;
    const title = cleanText(row.title);
    if (!title || title.length > 180 || !validDate(row.due_date)) throw new Error("Every selected action needs a title and a valid due date.");
    const candidate = { title, due_date: row.due_date, category: `Study / ${cleanText(row.source || "Manual entry")}`.slice(0, 50), priority: "medium", visibility: "private" };
    const identity = taskIdentity(candidate);
    if (existing.has(identity)) continue;
    existing.add(identity);
    result.push(candidate);
  }
  return result;
}

export function academicQueue(tasks, today) {
  if (!validDate(today)) throw new Error("A valid local date is required.");
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  const weekEnd = end.toISOString().slice(0, 10);
  const academic = tasks.filter(task => String(task.category || "").startsWith("Study / "));
  const open = academic.filter(task => !task.completed).sort((a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")) || a.title.localeCompare(b.title));
  return {
    open,
    overdue: open.filter(task => validDate(task.due_date) && task.due_date < today).length,
    week: open.filter(task => validDate(task.due_date) && task.due_date >= today && task.due_date < weekEnd).length,
    complete: academic.length - open.length,
  };
}
