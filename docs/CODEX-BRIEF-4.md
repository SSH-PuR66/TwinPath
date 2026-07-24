# Codex Brief 4 — personalization + iOS share fix (July 24, 2026)

## 1. Per-member personalization on sign-in
v22 (applied live) adds `track` ('household'|'cyber'|'nursing') to
benefit_enrollments and agent_proposals. On sign-in, resolve the member:
- Sergio's user → show household + cyber tracks first; twins countdown +
  Iona deadlines hero.
- Brianna's user (she joins via the existing invite-code flow /
  join_household) → show household + nursing tracks first: Nurse Corps
  window watcher, CNA option, DCC-specific items; her checklist state is
  her own (checklist progress should become per-member: store member id
  in each checklist item's `done_by` when ticked).
- Unassigned/legacy rows default to 'household' (both see them).
Add a small track chip on cards; Settings lets a member switch views.
When she signs up, tag nursing enrollments 'nursing' via the existing
enrollment PATCH pattern.

## 2. iOS share_target hardening (the mobile errors)
Known-finicky on iOS. Implement exactly:
1. manifest: share_target { method POST, enctype multipart/form-data,
   files accepting text/csv + .csv }.
2. SW: listen for the share POST fetch event; respond with redirect to
   /import?shared=1 AFTER buffering.
3. Buffer the file into IndexedDB (Cache API also fine) before app
   hydration — iOS loses the stream if you wait for React.
4. /import screen reads the buffer, shows the review table, then POSTs
   to /v1/financial/import/csv on user confirm. Clear buffer after.
5. Fallback path stays: paste-CSV screen with an iOS hint (share-target
   support varies by iOS version — feature-detect, never dead-end).

## 3. Application packet (your shared-import + packet work)
Keep packets LOCAL-FIRST: the packet holds profile-vault data only
(the worker already refuses SSNs/IDs). Export as filled PDF for the
human to complete + submit. No packet data leaves the household's own
storage — privacy is the feature. (ZKP-style selective disclosure is a
someday-idea once real institutions would accept it; do not build now.)

Contracts unchanged. Tests + build green before commits.
