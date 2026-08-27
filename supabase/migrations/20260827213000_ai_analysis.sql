alter table public.patents
  add constraint patents_id_owner_user_id_uq unique (id, owner_user_id);

create table public.ai_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  patent_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'QUEUED',
  model text,
  prompt_version text not null,
  source_pdf_path_snapshot text,
  result_json jsonb,
  executive_summary text,
  technical_problem text,
  proposed_solution text,
  novelty_points text[] not null default '{}',
  advantages text[] not null default '{}',
  limitations_and_risks text[] not null default '{}',
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_analysis_runs_patent_owner_fk
    foreign key (patent_id, owner_user_id)
    references public.patents(id, owner_user_id)
    on delete cascade,
  constraint ai_analysis_runs_identity_uq unique (id, patent_id, owner_user_id),
  constraint ai_analysis_runs_status_check check (
    status in ('QUEUED', 'PROCESSING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED')
  ),
  constraint ai_analysis_runs_tokens_nonnegative check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
    and (total_tokens is null or total_tokens >= 0)
  )
);

create table public.ai_analysis_suggestions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  patent_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  suggestion_type text not null,
  label text not null,
  normalized_value text,
  confidence_score numeric(5,4),
  evidence_page integer,
  evidence_quote text,
  payload jsonb not null default '{}'::jsonb,
  matched_chemical_id uuid references public.chemicals(id) on delete restrict,
  matched_commercial_product_id uuid references public.commercial_products(id) on delete restrict,
  matched_category_id uuid references public.application_categories(id) on delete restrict,
  matched_purpose_id uuid references public.technical_purposes(id) on delete restrict,
  matched_role_id uuid references public.chemical_roles(id) on delete restrict,
  review_status text not null default 'PENDING',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_analysis_suggestions_run_owner_fk
    foreign key (run_id, patent_id, owner_user_id)
    references public.ai_analysis_runs(id, patent_id, owner_user_id)
    on delete cascade,
  constraint ai_analysis_suggestions_type_check check (
    suggestion_type in (
      'CHEMICAL', 'COMMERCIAL_PRODUCT',
      'APPLICATION_CATEGORY', 'TECHNICAL_PURPOSE'
    )
  ),
  constraint ai_analysis_suggestions_label_not_blank check (btrim(label) <> ''),
  constraint ai_analysis_suggestions_confidence_check check (
    confidence_score is null or confidence_score between 0 and 1
  ),
  constraint ai_analysis_suggestions_page_check check (
    evidence_page is null or evidence_page > 0
  ),
  constraint ai_analysis_suggestions_review_status_check check (
    review_status in ('PENDING', 'ACCEPTED', 'REJECTED')
  ),
  constraint ai_analysis_suggestions_match_shape_check check (
    (suggestion_type = 'CHEMICAL' and matched_commercial_product_id is null
      and matched_category_id is null and matched_purpose_id is null)
    or (suggestion_type = 'COMMERCIAL_PRODUCT' and matched_chemical_id is null
      and matched_category_id is null and matched_purpose_id is null)
    or (suggestion_type = 'APPLICATION_CATEGORY' and matched_chemical_id is null
      and matched_commercial_product_id is null and matched_purpose_id is null
      and matched_role_id is null)
    or (suggestion_type = 'TECHNICAL_PURPOSE' and matched_chemical_id is null
      and matched_commercial_product_id is null and matched_category_id is null
      and matched_role_id is null)
  )
);

create index ai_analysis_runs_patent_created_idx
  on public.ai_analysis_runs (patent_id, created_at desc);
create index ai_analysis_runs_owner_status_idx
  on public.ai_analysis_runs (owner_user_id, status, created_at desc);
create index ai_analysis_suggestions_run_status_idx
  on public.ai_analysis_suggestions (run_id, review_status, confidence_score desc);
create index ai_analysis_suggestions_patent_type_idx
  on public.ai_analysis_suggestions (patent_id, suggestion_type, review_status);

create trigger ai_analysis_runs_set_updated_at
before update on public.ai_analysis_runs
for each row execute function private.set_updated_at();

create trigger ai_analysis_suggestions_set_updated_at
before update on public.ai_analysis_suggestions
for each row execute function private.set_updated_at();

revoke all on table public.ai_analysis_runs, public.ai_analysis_suggestions
from public, anon, authenticated;

grant select on table public.ai_analysis_runs, public.ai_analysis_suggestions
to authenticated;

grant select, insert, update, delete on table
  public.ai_analysis_runs,
  public.ai_analysis_suggestions
to service_role;

alter table public.ai_analysis_runs enable row level security;
alter table public.ai_analysis_suggestions enable row level security;

create policy ai_analysis_runs_select_own
on public.ai_analysis_runs for select
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy ai_analysis_suggestions_select_own
on public.ai_analysis_suggestions for select
to authenticated
using ((select auth.uid()) = owner_user_id);

create or replace function public.review_ai_suggestion(
  p_suggestion_id uuid,
  p_decision text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  suggestion public.ai_analysis_suggestions%rowtype;
  other_role_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_decision not in ('ACCEPTED', 'REJECTED') then
    raise exception 'Decision must be ACCEPTED or REJECTED';
  end if;

  select * into suggestion
  from public.ai_analysis_suggestions
  where id = p_suggestion_id
    and owner_user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Suggestion not found';
  end if;

  if suggestion.review_status <> 'PENDING' then
    return suggestion.review_status;
  end if;

  if p_decision = 'ACCEPTED' then
    if suggestion.suggestion_type in ('CHEMICAL', 'COMMERCIAL_PRODUCT') then
      select id into other_role_id
      from public.chemical_roles
      where lower(name) = 'other'
      limit 1;

      insert into public.patent_chemicals (
        patent_id,
        chemical_id,
        commercial_product_id,
        chemical_role_id,
        raw_material_name,
        confidence_score,
        source_type,
        ai_suggested,
        user_confirmed,
        source_page,
        source_quote
      )
      select
        suggestion.patent_id,
        suggestion.matched_chemical_id,
        suggestion.matched_commercial_product_id,
        coalesce(suggestion.matched_role_id, other_role_id),
        case
          when suggestion.matched_chemical_id is null
            and suggestion.matched_commercial_product_id is null
          then suggestion.label
          else null
        end,
        suggestion.confidence_score,
        'AI',
        true,
        true,
        suggestion.evidence_page,
        suggestion.evidence_quote
      where not exists (
        select 1
        from public.patent_chemicals existing
        where existing.patent_id = suggestion.patent_id
          and existing.chemical_role_id = coalesce(suggestion.matched_role_id, other_role_id)
          and existing.chemical_id is not distinct from suggestion.matched_chemical_id
          and existing.commercial_product_id is not distinct from suggestion.matched_commercial_product_id
          and lower(coalesce(existing.raw_material_name, '')) = lower(
            case
              when suggestion.matched_chemical_id is null
                and suggestion.matched_commercial_product_id is null
              then suggestion.label
              else ''
            end
          )
      );
    elsif suggestion.suggestion_type = 'APPLICATION_CATEGORY'
      and suggestion.matched_category_id is not null then
      insert into public.patent_application_categories (patent_id, category_id)
      values (suggestion.patent_id, suggestion.matched_category_id)
      on conflict do nothing;
    elsif suggestion.suggestion_type = 'TECHNICAL_PURPOSE'
      and suggestion.matched_purpose_id is not null then
      insert into public.patent_technical_purposes (patent_id, purpose_id)
      values (suggestion.patent_id, suggestion.matched_purpose_id)
      on conflict do nothing;
    end if;
  end if;

  update public.ai_analysis_suggestions
  set review_status = p_decision,
      reviewed_at = now()
  where id = suggestion.id;

  if not exists (
    select 1
    from public.ai_analysis_suggestions pending
    where pending.run_id = suggestion.run_id
      and pending.review_status = 'PENDING'
  ) then
    update public.ai_analysis_runs
    set status = 'COMPLETED'
    where id = suggestion.run_id;

    update public.patents
    set ai_analysis_status = 'COMPLETED'
    where id = suggestion.patent_id;
  end if;

  return p_decision;
end;
$$;

revoke all on function public.review_ai_suggestion(uuid, text) from public, anon;
grant execute on function public.review_ai_suggestion(uuid, text)
to authenticated, service_role;

insert into public.chemical_roles (id, name)
values ('10000000-0000-4000-8000-000000000011', 'Other')
on conflict (id) do nothing;
