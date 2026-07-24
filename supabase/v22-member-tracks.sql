-- v22: member-aware benefit and proposal focus. Applied live 2026-07-24.
-- Household is the safe legacy default; specialty tracks only change sorting
-- and presentation, never membership or access control.

alter table public.benefit_enrollments
  add column if not exists track text not null default 'household'
  check (track in ('household', 'cyber', 'nursing'));

alter table public.agent_proposals
  add column if not exists track text not null default 'household'
  check (track in ('household', 'cyber', 'nursing'));

update public.benefit_enrollments set track = 'household' where track is null;
update public.agent_proposals set track = 'household' where track is null;
