-- ─── 0007_rls.sql ─────────────────────────────────────────────────────────
-- Row Level Security for every private table.
--
-- Notes:
-- - The service_role key BYPASSES RLS entirely (Supabase default). Server-side
--   code must therefore authorize via lib/rbac.ts BEFORE using the admin client.
-- - Policies use the SECURITY DEFINER helpers from 0001 (is_super_admin(),
--   user_org_role(), user_has_org_role()) so policies never query user_roles
--   directly (avoids infinite recursion).
-- - Least privilege: there is no "authenticated can do everything" policy.
--   Every table gets a super_admin FOR ALL policy plus narrow role policies.
-- - audit_logs is INSERT-only: no UPDATE/DELETE policy exists for anyone.

-- ─── helper: may the caller view this candidate's private data? ──────────────
-- Yes when: super_admin, OR the candidate opted into searchability, OR the
-- candidate has an application with an org where the caller is active staff
-- (org_admin / hr_manager / recruiter / hiring_manager).
create or replace function public.can_view_candidate(p_candidate_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.candidate_profiles cp
      where cp.user_id = p_candidate_user_id
        and cp.is_searchable
    )
    or exists (
      select 1
      from public.applications a
      where a.user_id = p_candidate_user_id
        and public.user_org_role(a.org_id) in
          ('org_admin', 'hr_manager', 'recruiter', 'hiring_manager')
    );
$$;

-- ════════════════════════════ IDENTITY ═══════════════════════════════════════

alter table public.profiles enable row level security;
create policy profiles_superadmin on public.profiles
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy profiles_select on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_memberships m1
      join public.organization_memberships m2
        on m2.org_id = m1.org_id and m2.is_active
      where m1.user_id = auth.uid()
        and m1.is_active
        and m2.user_id = public.profiles.id
    )
  );
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

alter table public.user_roles enable row level security;
create policy user_roles_superadmin on public.user_roles
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy user_roles_select_own on public.user_roles
  for select to authenticated using (user_id = auth.uid());

alter table public.organizations enable row level security;
create policy organizations_superadmin on public.organizations
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy organizations_select_member on public.organizations
  for select to authenticated using (
    exists (
      select 1 from public.organization_memberships om
      where om.org_id = public.organizations.id
        and om.user_id = auth.uid()
        and om.is_active
    )
  );
-- Employer self-service signup: any signed-in user may create an organization
-- row. Membership and roles are assigned separately via server actions.
create policy organizations_insert on public.organizations
  for insert to authenticated with check (true);
create policy organizations_update_admin on public.organizations
  for update to authenticated
  using (public.user_org_role(id) = 'org_admin')
  with check (public.user_org_role(id) = 'org_admin');

-- Public subset of organization fields for anonymous visitors (used by the
-- public job board). Runs with the view owner's rights (bypasses RLS) and is
-- deliberately limited to non-sensitive columns of active accounts only.
create view public.organization_public_profiles as
  select id, name, slug, logo_url, cover_url, about, industry, website,
         size_range, verification_status
  from public.organizations
  where account_status = 'active';
grant select on public.organization_public_profiles to anon, authenticated;

alter table public.organization_memberships enable row level security;
create policy organization_memberships_superadmin on public.organization_memberships
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy organization_memberships_select on public.organization_memberships
  for select to authenticated using (
    user_id = auth.uid()
    or public.user_org_role(org_id) in ('org_admin', 'hr_manager')
  );
create policy organization_memberships_manage on public.organization_memberships
  for all to authenticated
  using (public.user_org_role(org_id) = 'org_admin')
  with check (public.user_org_role(org_id) = 'org_admin');

alter table public.departments enable row level security;
create policy departments_superadmin on public.departments
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy departments_select on public.departments
  for select to authenticated using (
    public.user_org_role(org_id) is not null
  );
create policy departments_manage on public.departments
  for all to authenticated
  using (public.user_org_role(org_id) in ('org_admin', 'hr_manager'))
  with check (public.user_org_role(org_id) in ('org_admin', 'hr_manager'));

alter table public.organization_invitations enable row level security;
create policy organization_invitations_superadmin on public.organization_invitations
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy organization_invitations_staff on public.organization_invitations
  for all to authenticated
  using (public.user_org_role(org_id) in ('org_admin', 'hr_manager'))
  with check (public.user_org_role(org_id) in ('org_admin', 'hr_manager'));
-- Invitation acceptance itself runs server-side (service role) via token.

alter table public.audit_logs enable row level security;
create policy audit_logs_select_superadmin on public.audit_logs
  for select to authenticated using (public.is_super_admin());
-- Server actions write through the service role (bypasses RLS); direct
-- authenticated inserts are allowed so request-scoped clients can log too.
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated with check (true);
-- Deliberately NO update/delete policies: audit_logs is INSERT-only.

-- ════════════════════════════ CATALOG ════════════════════════════════════════

alter table public.job_categories enable row level security;
create policy job_categories_superadmin on public.job_categories
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy job_categories_select_public on public.job_categories
  for select to anon, authenticated using (true);

alter table public.locations enable row level security;
create policy locations_superadmin on public.locations
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy locations_select_public on public.locations
  for select to anon, authenticated using (true);

alter table public.jobs enable row level security;
create policy jobs_superadmin on public.jobs
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
-- Public (incl. anonymous): only live, published jobs.
create policy jobs_select_public on public.jobs
  for select to anon, authenticated using (
    status = 'published' and (deadline is null or deadline > now())
  );
-- Org staff: all jobs of their own orgs (drafts, paused, etc.).
create policy jobs_select_staff on public.jobs
  for select to authenticated using (
    public.user_org_role(org_id) is not null
  );
create policy jobs_insert_staff on public.jobs
  for insert to authenticated with check (
    created_by = auth.uid()
    and public.user_org_role(org_id) in ('org_admin', 'hr_manager', 'recruiter')
  );
create policy jobs_update_staff on public.jobs
  for update to authenticated
  using (public.user_org_role(org_id) in ('org_admin', 'hr_manager', 'recruiter'))
  with check (public.user_org_role(org_id) in ('org_admin', 'hr_manager', 'recruiter'));
create policy jobs_delete_admin on public.jobs
  for delete to authenticated using (public.user_org_role(org_id) = 'org_admin');

alter table public.job_questions enable row level security;
create policy job_questions_superadmin on public.job_questions
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy job_questions_select on public.job_questions
  for select to anon, authenticated using (
    exists (
      select 1 from public.jobs j
      where j.id = public.job_questions.job_id
        and (j.status = 'published' and (j.deadline is null or j.deadline > now())
             or public.user_org_role(j.org_id) is not null)
    )
  );
create policy job_questions_manage on public.job_questions
  for all to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.id = public.job_questions.job_id
        and public.user_org_role(j.org_id) in ('org_admin', 'hr_manager', 'recruiter')
    )
  )
  with check (
    exists (
      select 1 from public.jobs j
      where j.id = public.job_questions.job_id
        and public.user_org_role(j.org_id) in ('org_admin', 'hr_manager', 'recruiter')
    )
  );

alter table public.job_skills enable row level security;
create policy job_skills_superadmin on public.job_skills
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy job_skills_select on public.job_skills
  for select to anon, authenticated using (
    exists (
      select 1 from public.jobs j
      where j.id = public.job_skills.job_id
        and (j.status = 'published' and (j.deadline is null or j.deadline > now())
             or public.user_org_role(j.org_id) is not null)
    )
  );
create policy job_skills_manage on public.job_skills
  for all to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.id = public.job_skills.job_id
        and public.user_org_role(j.org_id) in ('org_admin', 'hr_manager', 'recruiter')
    )
  )
  with check (
    exists (
      select 1 from public.jobs j
      where j.id = public.job_skills.job_id
        and public.user_org_role(j.org_id) in ('org_admin', 'hr_manager', 'recruiter')
    )
  );

alter table public.job_approvals enable row level security;
create policy job_approvals_superadmin on public.job_approvals
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy job_approvals_select_staff on public.job_approvals
  for select to authenticated using (
    exists (
      select 1 from public.jobs j
      where j.id = public.job_approvals.job_id
        and public.user_org_role(j.org_id) is not null
    )
  );
create policy job_approvals_decide on public.job_approvals
  for insert to authenticated with check (
    decided_by = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = public.job_approvals.job_id
        and public.user_org_role(j.org_id) in ('org_admin', 'hr_manager')
    )
  );

-- ════════════════════════════ CANDIDATES ═════════════════════════════════════

alter table public.candidate_profiles enable row level security;
create policy candidate_profiles_superadmin on public.candidate_profiles
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy candidate_profiles_select on public.candidate_profiles
  for select to authenticated using (
    user_id = auth.uid() or public.can_view_candidate(user_id)
  );
create policy candidate_profiles_insert_own on public.candidate_profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy candidate_profiles_update_own on public.candidate_profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy candidate_profiles_delete_own on public.candidate_profiles
  for delete to authenticated using (user_id = auth.uid());

-- Sub-tables share one pattern: the candidate owns them; org staff may read
-- them only via can_view_candidate() (applied-to-org or searchable).
alter table public.candidate_education enable row level security;
alter table public.candidate_experience enable row level security;
alter table public.candidate_skills enable row level security;
alter table public.candidate_certifications enable row level security;
alter table public.candidate_documents enable row level security;

create policy candidate_education_superadmin on public.candidate_education
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy candidate_education_access on public.candidate_education
  for all to authenticated
  using (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.id = public.candidate_education.profile_id
        and (cp.user_id = auth.uid() or public.can_view_candidate(cp.user_id))
    )
  )
  with check (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.id = public.candidate_education.profile_id
        and cp.user_id = auth.uid()
    )
  );

create policy candidate_experience_superadmin on public.candidate_experience
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy candidate_experience_access on public.candidate_experience
  for all to authenticated
  using (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.id = public.candidate_experience.profile_id
        and (cp.user_id = auth.uid() or public.can_view_candidate(cp.user_id))
    )
  )
  with check (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.id = public.candidate_experience.profile_id
        and cp.user_id = auth.uid()
    )
  );

create policy candidate_skills_superadmin on public.candidate_skills
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy candidate_skills_access on public.candidate_skills
  for all to authenticated
  using (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.id = public.candidate_skills.profile_id
        and (cp.user_id = auth.uid() or public.can_view_candidate(cp.user_id))
    )
  )
  with check (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.id = public.candidate_skills.profile_id
        and cp.user_id = auth.uid()
    )
  );

create policy candidate_certifications_superadmin on public.candidate_certifications
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy candidate_certifications_access on public.candidate_certifications
  for all to authenticated
  using (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.id = public.candidate_certifications.profile_id
        and (cp.user_id = auth.uid() or public.can_view_candidate(cp.user_id))
    )
  )
  with check (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.id = public.candidate_certifications.profile_id
        and cp.user_id = auth.uid()
    )
  );

create policy candidate_documents_superadmin on public.candidate_documents
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy candidate_documents_access on public.candidate_documents
  for all to authenticated
  using (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.id = public.candidate_documents.profile_id
        and (cp.user_id = auth.uid() or public.can_view_candidate(cp.user_id))
    )
  )
  with check (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.id = public.candidate_documents.profile_id
        and cp.user_id = auth.uid()
    )
  );

alter table public.saved_jobs enable row level security;
create policy saved_jobs_superadmin on public.saved_jobs
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy saved_jobs_own on public.saved_jobs
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.job_alerts enable row level security;
create policy job_alerts_superadmin on public.job_alerts
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy job_alerts_own on public.job_alerts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ════════════════════════════ APPLICATIONS ══════════════════════════════════

alter table public.applications enable row level security;
create policy applications_superadmin on public.applications
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy applications_select on public.applications
  for select to authenticated using (
    user_id = auth.uid()
    or public.user_org_role(org_id) in ('org_admin', 'hr_manager', 'recruiter', 'hiring_manager')
  );
-- Candidates apply themselves, only to live published jobs.
create policy applications_insert_candidate on public.applications
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status = 'published'
        and (j.deadline is null or j.deadline > now())
    )
  );
-- Stage/field changes are staff-only; candidates withdraw via server action.
create policy applications_update_staff on public.applications
  for update to authenticated
  using (public.user_org_role(org_id) in ('org_admin', 'hr_manager', 'recruiter'))
  with check (public.user_org_role(org_id) in ('org_admin', 'hr_manager', 'recruiter'));

alter table public.application_answers enable row level security;
alter table public.application_documents enable row level security;
alter table public.application_status_history enable row level security;
alter table public.application_assignments enable row level security;
alter table public.application_notes enable row level security;
alter table public.candidate_messages enable row level security;

create policy application_answers_superadmin on public.application_answers
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy application_answers_select on public.application_answers
  for select to authenticated using (
    exists (
      select 1 from public.applications a
      where a.id = public.application_answers.application_id
        and (a.user_id = auth.uid()
             or public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter', 'hiring_manager'))
    )
  );
create policy application_answers_insert on public.application_answers
  for insert to authenticated with check (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and (a.user_id = auth.uid()
             or public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter'))
    )
  );

create policy application_documents_superadmin on public.application_documents
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy application_documents_select on public.application_documents
  for select to authenticated using (
    exists (
      select 1 from public.applications a
      where a.id = public.application_documents.application_id
        and (a.user_id = auth.uid()
             or public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter', 'hiring_manager'))
    )
  );
create policy application_documents_insert on public.application_documents
  for insert to authenticated with check (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and (a.user_id = auth.uid()
             or public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter'))
    )
  );

create policy application_status_history_superadmin on public.application_status_history
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy application_status_history_select on public.application_status_history
  for select to authenticated using (
    exists (
      select 1 from public.applications a
      where a.id = public.application_status_history.application_id
        and (a.user_id = auth.uid()
             or public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter', 'hiring_manager'))
    )
  );
create policy application_status_history_insert_staff on public.application_status_history
  for insert to authenticated with check (
    changed_by = auth.uid()
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter')
    )
  );

create policy application_assignments_superadmin on public.application_assignments
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy application_assignments_staff on public.application_assignments
  for all to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = public.application_assignments.application_id
        and public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter')
    )
  )
  with check (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter')
    )
  );

create policy application_notes_superadmin on public.application_notes
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy application_notes_staff on public.application_notes
  for all to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = public.application_notes.application_id
        and public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter', 'hiring_manager')
    )
  )
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter', 'hiring_manager')
    )
  );

create policy candidate_messages_superadmin on public.candidate_messages
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy candidate_messages_select on public.candidate_messages
  for select to authenticated using (
    exists (
      select 1 from public.applications a
      where a.id = public.candidate_messages.application_id
        and (a.user_id = auth.uid()
             or public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter', 'hiring_manager'))
    )
  );
create policy candidate_messages_insert on public.candidate_messages
  for insert to authenticated with check (
    sender_user_id = auth.uid()
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and (
          (a.user_id = auth.uid() and is_from_candidate)
          or (a.user_id <> auth.uid()
              and not is_from_candidate
              and public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter'))
        )
    )
  );

-- ════════════════════════════ HIRING ═════════════════════════════════════════

alter table public.interviews enable row level security;
create policy interviews_superadmin on public.interviews
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy interviews_select on public.interviews
  for select to authenticated using (
    public.user_org_role(org_id) in ('org_admin', 'hr_manager', 'recruiter', 'hiring_manager')
    or exists (
      select 1 from public.applications a
      where a.id = public.interviews.application_id and a.user_id = auth.uid()
    )
  );
create policy interviews_manage on public.interviews
  for all to authenticated
  using (public.user_org_role(org_id) in ('org_admin', 'hr_manager', 'recruiter'))
  with check (public.user_org_role(org_id) in ('org_admin', 'hr_manager', 'recruiter'));

alter table public.interview_participants enable row level security;
create policy interview_participants_superadmin on public.interview_participants
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy interview_participants_select on public.interview_participants
  for select to authenticated using (
    exists (
      select 1 from public.interviews i
      where i.id = public.interview_participants.interview_id
        and (public.user_org_role(i.org_id) in ('org_admin', 'hr_manager', 'recruiter', 'hiring_manager')
             or exists (
               select 1 from public.applications a
               where a.id = i.application_id and a.user_id = auth.uid()
             ))
    )
  );
create policy interview_participants_manage on public.interview_participants
  for all to authenticated
  using (
    exists (
      select 1 from public.interviews i
      where i.id = public.interview_participants.interview_id
        and public.user_org_role(i.org_id) in ('org_admin', 'hr_manager', 'recruiter')
    )
  )
  with check (
    exists (
      select 1 from public.interviews i
      where i.id = interview_id
        and public.user_org_role(i.org_id) in ('org_admin', 'hr_manager', 'recruiter')
    )
  );

alter table public.interview_feedback enable row level security;
create policy interview_feedback_superadmin on public.interview_feedback
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy interview_feedback_select_staff on public.interview_feedback
  for select to authenticated using (
    exists (
      select 1 from public.interviews i
      where i.id = public.interview_feedback.interview_id
        and public.user_org_role(i.org_id) in ('org_admin', 'hr_manager', 'recruiter', 'hiring_manager')
    )
  );
create policy interview_feedback_insert on public.interview_feedback
  for insert to authenticated with check (
    reviewer_user_id = auth.uid()
    and exists (
      select 1 from public.interviews i
      where i.id = interview_id
        and public.user_org_role(i.org_id) in ('org_admin', 'hr_manager', 'recruiter', 'hiring_manager')
    )
  );
create policy interview_feedback_update on public.interview_feedback
  for update to authenticated
  using (
    reviewer_user_id = auth.uid()
    or exists (
      select 1 from public.interviews i
      where i.id = public.interview_feedback.interview_id
        and public.user_org_role(i.org_id) = 'org_admin'
    )
  )
  with check (reviewer_user_id = auth.uid());

alter table public.offers enable row level security;
create policy offers_superadmin on public.offers
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy offers_select on public.offers
  for select to authenticated using (
    public.user_org_role(org_id) in ('org_admin', 'hr_manager', 'recruiter')
    or exists (
      select 1 from public.applications a
      where a.id = public.offers.application_id and a.user_id = auth.uid()
    )
  );
-- Offer lifecycle changes (accept/decline by candidate) run via server actions.
create policy offers_manage on public.offers
  for all to authenticated
  using (public.user_org_role(org_id) in ('org_admin', 'hr_manager'))
  with check (public.user_org_role(org_id) in ('org_admin', 'hr_manager'));

alter table public.offer_approvals enable row level security;
create policy offer_approvals_superadmin on public.offer_approvals
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy offer_approvals_select on public.offer_approvals
  for select to authenticated using (
    exists (
      select 1 from public.offers o
      where o.id = public.offer_approvals.offer_id
        and public.user_org_role(o.org_id) in ('org_admin', 'hr_manager')
    )
  );
create policy offer_approvals_insert on public.offer_approvals
  for insert to authenticated with check (
    approver_user_id = auth.uid()
    and exists (
      select 1 from public.offers o
      where o.id = offer_id
        and public.user_org_role(o.org_id) in ('org_admin', 'hr_manager')
    )
  );

alter table public.hiring_records enable row level security;
create policy hiring_records_superadmin on public.hiring_records
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy hiring_records_staff on public.hiring_records
  for all to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = public.hiring_records.application_id
        and public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter')
    )
  )
  with check (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and public.user_org_role(a.org_id) in ('org_admin', 'hr_manager', 'recruiter')
    )
  );

-- ════════════════════════════ CONFIG ═════════════════════════════════════════

alter table public.pipeline_stages enable row level security;
create policy pipeline_stages_superadmin on public.pipeline_stages
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy pipeline_stages_select_public on public.pipeline_stages
  for select to anon, authenticated using (true);

alter table public.pipeline_transitions enable row level security;
create policy pipeline_transitions_superadmin on public.pipeline_transitions
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy pipeline_transitions_select_public on public.pipeline_transitions
  for select to anon, authenticated using (true);

alter table public.notifications enable row level security;
create policy notifications_superadmin on public.notifications
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy notifications_own on public.notifications
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.notification_preferences enable row level security;
create policy notification_preferences_superadmin on public.notification_preferences
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.notification_delivery_logs enable row level security;
create policy notification_delivery_logs_superadmin on public.notification_delivery_logs
  for select to authenticated using (public.is_super_admin());
-- Writes go through the service role (lib/notifications.ts).

alter table public.email_templates enable row level security;
create policy email_templates_superadmin on public.email_templates
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy email_templates_select_staff on public.email_templates
  for select to authenticated using (
    exists (
      select 1 from public.organization_memberships om
      where om.user_id = auth.uid() and om.is_active
    )
  );

alter table public.platform_settings enable row level security;
create policy platform_settings_superadmin on public.platform_settings
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy platform_settings_select on public.platform_settings
  for select to authenticated using (true);

alter table public.organization_settings enable row level security;
create policy organization_settings_superadmin on public.organization_settings
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy organization_settings_select on public.organization_settings
  for select to authenticated using (public.user_org_role(org_id) is not null);
create policy organization_settings_manage on public.organization_settings
  for all to authenticated
  using (public.user_org_role(org_id) = 'org_admin')
  with check (public.user_org_role(org_id) = 'org_admin');

alter table public.consent_records enable row level security;
create policy consent_records_superadmin on public.consent_records
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy consent_records_own on public.consent_records
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.privacy_requests enable row level security;
create policy privacy_requests_superadmin on public.privacy_requests
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy privacy_requests_select_own on public.privacy_requests
  for select to authenticated using (user_id = auth.uid());
create policy privacy_requests_insert_own on public.privacy_requests
  for insert to authenticated with check (user_id = auth.uid());
