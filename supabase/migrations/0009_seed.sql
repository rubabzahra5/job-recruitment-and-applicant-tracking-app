-- ─── 0009_seed.sql ────────────────────────────────────────────────────────
-- Reference data: job categories, locations, pipeline definition, platform
-- settings. Idempotent (safe to re-run).

-- ─── job_categories ─────────────────────────────────────────────────────────
insert into public.job_categories (name, slug, icon) values
  ('IT', 'it', '💻'),
  ('Software Development', 'software-development', '🧑‍💻'),
  ('Accounting', 'accounting', '🧾'),
  ('Finance', 'finance', '💹'),
  ('Sales', 'sales', '🤝'),
  ('Marketing', 'marketing', '📣'),
  ('Customer Service', 'customer-service', '🎧'),
  ('Administration', 'administration', '🗂️'),
  ('Engineering', 'engineering', '⚙️'),
  ('Education', 'education', '🎓'),
  ('Healthcare', 'healthcare', '⚕️'),
  ('Operations', 'operations', '🏭'),
  ('Human Resources', 'human-resources', '🧑‍🤝‍🧑')
on conflict (slug) do update
  set name = excluded.name, icon = excluded.icon;

-- ─── locations ──────────────────────────────────────────────────────────────
insert into public.locations (city, province) values
  ('Karachi', 'Sindh'),
  ('Hyderabad', 'Sindh'),
  ('Lahore', 'Punjab'),
  ('Rawalpindi', 'Punjab'),
  ('Faisalabad', 'Punjab'),
  ('Multan', 'Punjab'),
  ('Gujranwala', 'Punjab'),
  ('Sialkot', 'Punjab'),
  ('Islamabad', 'Islamabad Capital Territory'),
  ('Peshawar', 'Khyber Pakhtunkhwa'),
  ('Quetta', 'Balochistan'),
  ('Gilgit', 'Gilgit-Baltistan'),
  ('Muzaffarabad', 'Azad Jammu and Kashmir')
on conflict (city, province) do nothing;

-- ─── pipeline_stages ────────────────────────────────────────────────────────
insert into public.pipeline_stages (key, label, sort_order, is_terminal) values
  ('applied', 'Applied', 1, false),
  ('initial_screening', 'Initial Screening', 2, false),
  ('shortlisted', 'Shortlisted', 3, false),
  ('assessment', 'Assessment', 4, false),
  ('interview_scheduled', 'Interview Scheduled', 5, false),
  ('interview_completed', 'Interview Completed', 6, false),
  ('reference_check', 'Reference Check', 7, false),
  ('offer_pending', 'Offer Pending', 8, false),
  ('offer_accepted', 'Offer Accepted', 9, false),
  ('offer_declined', 'Offer Declined', 10, true),
  ('hired', 'Hired', 11, true),
  ('rejected', 'Rejected', 12, true),
  ('withdrawn', 'Withdrawn', 13, true)
on conflict (key) do update
  set label = excluded.label,
      sort_order = excluded.sort_order,
      is_terminal = excluded.is_terminal;

-- ─── pipeline_transitions ───────────────────────────────────────────────────
-- Happy path: applied → … → hired. Any non-terminal stage → rejected.
-- Any non-terminal stage → withdrawn (candidate-driven).
insert into public.pipeline_transitions (from_stage, to_stage)
select f.id, t.id
from (values
  ('applied', 'initial_screening'),
  ('initial_screening', 'shortlisted'),
  ('shortlisted', 'assessment'),
  ('assessment', 'interview_scheduled'),
  ('interview_scheduled', 'interview_completed'),
  ('interview_completed', 'reference_check'),
  ('reference_check', 'offer_pending'),
  ('offer_pending', 'offer_accepted'),
  ('offer_accepted', 'hired'),
  ('offer_pending', 'offer_declined'),
  ('applied', 'rejected'),
  ('initial_screening', 'rejected'),
  ('shortlisted', 'rejected'),
  ('assessment', 'rejected'),
  ('interview_scheduled', 'rejected'),
  ('interview_completed', 'rejected'),
  ('reference_check', 'rejected'),
  ('offer_pending', 'rejected'),
  ('applied', 'withdrawn'),
  ('initial_screening', 'withdrawn'),
  ('shortlisted', 'withdrawn'),
  ('assessment', 'withdrawn'),
  ('interview_scheduled', 'withdrawn'),
  ('interview_completed', 'withdrawn'),
  ('reference_check', 'withdrawn'),
  ('offer_pending', 'withdrawn'),
  ('offer_accepted', 'withdrawn')
) as v(fkey, tkey)
join public.pipeline_stages f on f.key = v.fkey
join public.pipeline_stages t on t.key = v.tkey
on conflict do nothing;

-- ─── platform_settings ──────────────────────────────────────────────────────
insert into public.platform_settings (key, value) values
  ('operating_mode', '"centralized"'),
  ('currency', '"PKR"'),
  ('timezone', '"Asia/Karachi"'),
  ('employee_portal_enabled', 'false'),
  ('employer_approval_required', 'true'),
  ('job_moderation_required', 'true')
on conflict (key) do update set value = excluded.value;
