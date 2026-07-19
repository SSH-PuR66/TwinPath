begin;

alter table public.appointments
  add column if not exists category text
    not null default 'Personal'
    check (
      category in (
        'Prenatal',
        'Ultrasound',
        'Maternal-fetal medicine',
        'WIC',
        'Benefits',
        'School',
        'Financial aid',
        'Work',
        'Interview',
        'Performance',
        'Childcare',
        'Personal'
      )
    );

alter table public.appointments
  add column if not exists reminder_minutes integer
    check (
      reminder_minutes is null
      or reminder_minutes between 0 and 10080
    );

alter table public.appointments
  add column if not exists transportation_plan text
    check (
      transportation_plan is null
      or char_length(transportation_plan) <= 1000
    );

alter table public.appointments
  add column if not exists questions text
    check (
      questions is null
      or char_length(questions) <= 3000
    );

create index if not exists appointments_category_idx
  on public.appointments(household_id, category);

commit;
