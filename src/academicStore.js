import { prepareAcademicTasks } from "./academicIntake.js";

export function ownPrivateRecords(records, userId) {
  if (!userId) return [];
  return records.filter(record => record.owner_user_id === userId && record.visibility === "private");
}

// One INSERT keeps a reviewed batch atomic; ownership comes from the signed-in
// app context, never from an imported document. Existing table RLS still applies.
export async function saveAcademicBatch(client, { rows, tasks, householdId, userId }) {
  if (!householdId || !userId) throw new Error("Sign in to a household before saving coursework.");
  const prepared = prepareAcademicTasks(rows.map(row => ({
    ...row, selected: true, source: row.source || String(row.category || "").replace(/^Study \/ /, ""),
  })), ownPrivateRecords(tasks, userId));
  if (!prepared.length) return [];
  const values = prepared.map(row => ({ ...row, household_id: householdId, owner_user_id: userId }));
  const { data, error } = await client.from("tasks").insert(values).select("*");
  if (error) throw new Error("Coursework could not be saved. Check your connection and try again.");
  if (!Array.isArray(data) || data.length !== values.length || ownPrivateRecords(data, userId).length !== values.length) {
    // Do not retry automatically: an ambiguous response may follow a committed INSERT.
    throw new Error("The save response was incomplete. Refresh your plan before importing this source again.");
  }
  return data;
}
