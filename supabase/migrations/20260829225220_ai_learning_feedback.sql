-- User-confirmed AI corrections are kept separate from the curated chemistry
-- catalog.  The Edge Functions write this table with the service role; clients
-- may only read their own memory through RLS.
create table public.ai_learning_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_suggestion_id uuid references public.ai_analysis_suggestions(id) on delete set null,
  source_run_id uuid references public.ai_analysis_runs(id) on delete set null,
  source_patent_id uuid references public.patents(id) on delete set null,
  suggestion_type text not null,
  observed_label text not null,
  normalized_observed_label text not null,
  decision text not null,
  resolved_label text,
  correction_note text,
  matched_chemical_id uuid references public.chemicals(id) on delete set null,
  matched_commercial_product_id uuid references public.commercial_products(id) on delete set null,
  matched_category_id uuid references public.application_categories(id) on delete set null,
  matched_purpose_id uuid references public.technical_purposes(id) on delete set null,
  matched_role_id uuid references public.chemical_roles(id) on delete set null,
  evidence_quote text,
  evidence_page integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_learning_feedback_type_check check (
    suggestion_type in ('CHEMICAL', 'COMMERCIAL_PRODUCT', 'APPLICATION_CATEGORY', 'TECHNICAL_PURPOSE')
  ),
  constraint ai_learning_feedback_decision_check check (
    decision in ('ACCEPTED', 'CORRECTED', 'REJECTED')
  ),
  constraint ai_learning_feedback_observed_not_blank check (
    btrim(observed_label) <> '' and btrim(normalized_observed_label) <> ''
  ),
  constraint ai_learning_feedback_resolved_shape_check check (
    (decision = 'CORRECTED' and resolved_label is not null and btrim(resolved_label) <> '')
    or decision <> 'CORRECTED'
  ),
  constraint ai_learning_feedback_page_check check (evidence_page is null or evidence_page > 0),
  constraint ai_learning_feedback_owner_suggestion_unique unique (owner_user_id, source_suggestion_id)
);

create index ai_learning_feedback_owner_label_idx
  on public.ai_learning_feedback (owner_user_id, normalized_observed_label, updated_at desc);

create index ai_learning_feedback_source_patent_idx
  on public.ai_learning_feedback (source_patent_id)
  where source_patent_id is not null;

create trigger ai_learning_feedback_set_updated_at
before update on public.ai_learning_feedback
for each row execute function private.set_updated_at();

revoke all on table public.ai_learning_feedback from public, anon, authenticated;
grant select on table public.ai_learning_feedback to authenticated;
grant select, insert, update, delete on table public.ai_learning_feedback to service_role;

alter table public.ai_learning_feedback enable row level security;

create policy ai_learning_feedback_select_own
on public.ai_learning_feedback for select
to authenticated
using ((select auth.uid()) = owner_user_id);

comment on table public.ai_learning_feedback is
  'Per-user accepted/rejected/corrected AI terminology memory. Never mutates the curated chemistry catalog.';
