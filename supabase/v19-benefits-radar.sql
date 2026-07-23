-- v19: Benefits Radar — catalog of programs, household enrollment tracking.
-- Applied to the live project on 2026-07-23 via MCP; kept here so files and
-- database never drift.

create table if not exists public.benefit_programs (
  key text primary key
    check (key ~ '^[a-z0-9][a-z0-9_.-]{1,60}$'),
  name text not null check (char_length(name) between 3 and 120),
  category text not null
    check (category in ('tax_credit','benefit','savings_match','education','health','tool')),
  jurisdiction text not null default 'US'
    check (char_length(jurisdiction) between 2 and 40),
  est_value_note text check (est_value_note is null or char_length(est_value_note) <= 240),
  eligibility_summary text not null check (char_length(eligibility_summary) <= 500),
  how_to_apply text not null check (char_length(how_to_apply) <= 500),
  official_url text check (official_url is null or official_url ~ '^https://'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.benefit_enrollments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  program_key text not null references public.benefit_programs(key) on delete restrict,
  status text not null default 'researching'
    check (status in ('researching','eligible_likely','applied','approved','denied','renewing','not_eligible')),
  next_deadline_on date,
  est_annual_value numeric not null default 0 check (est_annual_value >= 0),
  notes text check (notes is null or char_length(notes) <= 2000),
  checklist jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (household_id, program_key)
);

alter table public.benefit_programs enable row level security;
alter table public.benefit_enrollments enable row level security;

revoke all on public.benefit_programs from public, anon, authenticated;
revoke all on public.benefit_enrollments from public, anon, authenticated;

grant select on public.benefit_programs to authenticated;
grant select on public.benefit_enrollments to authenticated;

drop policy if exists "Anyone signed in reads program catalog" on public.benefit_programs;
create policy "Anyone signed in reads program catalog"
  on public.benefit_programs for select
  to authenticated
  using (active);

drop policy if exists "Members read household enrollments" on public.benefit_enrollments;
create policy "Members read household enrollments"
  on public.benefit_enrollments for select
  to authenticated
  using (public.is_household_member(household_id, (select auth.uid())));

-- Seed the catalog (idempotent). Values are educational summaries, not advice.
insert into public.benefit_programs
  (key, name, category, jurisdiction, est_value_note, eligibility_summary, how_to_apply, official_url)
values
  ('eitc','Earned Income Tax Credit','tax_credit','US','Refundable; can be several thousand dollars/yr with two children','Refundable federal credit for low-to-moderate earned income; amount rises with qualifying children.','Claim on your federal tax return; free VITA sites can prepare it.','https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc'),
  ('ctc','Child Tax Credit','tax_credit','US','Per qualifying child per year','Federal credit per qualifying child under 17; partially refundable.','Claim on your federal tax return with each child''s SSN.','https://www.irs.gov/credits-deductions/individuals/child-tax-credit'),
  ('savers_credit','Saver''s Credit (Retirement Savings Contributions Credit)','tax_credit','US','10-50% credit on up to $2,000 of retirement contributions','Credit for IRA/401k contributions at lower incomes; rate depends on AGI.','Contribute to an IRA, then claim Form 8880 on your return.','https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-savings-contributions-savers-credit'),
  ('wic','WIC (Women, Infants, and Children)','benefit','US','Monthly food benefits + support during pregnancy and infancy','Nutrition support for pregnant/postpartum parents and children under 5, income-qualified.','Apply through your local WIC agency; NY applications start locally.','https://www.fns.usda.gov/wic'),
  ('snap','SNAP (Food Assistance)','benefit','US','Monthly grocery benefit','Income-based monthly food benefit; student rules have exemptions for parents.','Apply through your state; NY uses myBenefits.','https://www.fns.usda.gov/snap/supplemental-nutrition-assistance-program'),
  ('chip_medicaid','Children''s Health Insurance (CHIP/Medicaid)','health','US','Free or very low cost coverage for kids','Health coverage for children in income-qualified families; pregnancy coverage also available.','Apply via NY State of Health marketplace.','https://www.insurekidsnow.gov'),
  ('heap','HEAP (Home Energy Assistance)','benefit','US-NY','Seasonal help with heating costs','Income-qualified help with energy bills in NY; opens each fall.','Apply through NY OTDA/myBenefits when the season opens.','https://otda.ny.gov/programs/heap/'),
  ('ny_childcare','NY Child Care Assistance','benefit','US-NY','Can cover most of child care cost','Subsidized child care for income-eligible working/studying parents.','Apply through your county department of social services.','https://ocfs.ny.gov/programs/childcare/'),
  ('ny_529','NY 529 College Savings (state tax deduction)','education','US-NY','NY deduction up to $5,000/yr per filer for contributions','NY taxpayers can deduct 529 contributions from state income; funds grow tax-free for education.','Open a NY 529 Direct Plan account online.','https://www.nysaves.org'),
  ('tap','NY Tuition Assistance Program (TAP)','education','US-NY','Up to several thousand/yr toward tuition','NY grant for income-eligible NY residents attending NY colleges.','Apply via FAFSA then the NY TAP application.','https://www.hesc.ny.gov'),
  ('vita','VITA Free Tax Preparation','tool','US','Free; ensures credits above are actually claimed','Free IRS-certified tax prep for lower incomes; maximizes EITC/CTC correctly.','Find a local VITA site during filing season.','https://irs.treasury.gov/freetaxprep/'),
  ('ida_match','Matched Savings Programs (IDAs)','savings_match','US','Some programs match savings 2:1 to 4:1','Nonprofit matched-savings accounts for education, business, or first home at lower incomes.','Search local NY community action agencies for open IDA programs.','https://prosperitynow.org'),
  ('roth_ira','Roth IRA (started young)','savings_match','US','Tax-free growth for decades; contributions stay withdrawable','Anyone with earned income can contribute; at 18-19 the compounding horizon is the advantage.','Open at any major low-fee brokerage; pairs with the Saver''s Credit.','https://www.irs.gov/retirement-plans/roth-iras')
on conflict (key) do nothing;
