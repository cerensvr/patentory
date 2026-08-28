-- Cover AI-table foreign keys so deletes and relationship checks stay efficient
-- as a user's patent library grows.
create index ai_analysis_runs_patent_owner_idx
  on public.ai_analysis_runs (patent_id, owner_user_id);

create index ai_analysis_suggestions_run_patent_owner_idx
  on public.ai_analysis_suggestions (run_id, patent_id, owner_user_id);

create index ai_analysis_suggestions_owner_idx
  on public.ai_analysis_suggestions (owner_user_id);

create index ai_analysis_suggestions_chemical_idx
  on public.ai_analysis_suggestions (matched_chemical_id)
  where matched_chemical_id is not null;

create index ai_analysis_suggestions_product_idx
  on public.ai_analysis_suggestions (matched_commercial_product_id)
  where matched_commercial_product_id is not null;

create index ai_analysis_suggestions_category_idx
  on public.ai_analysis_suggestions (matched_category_id)
  where matched_category_id is not null;

create index ai_analysis_suggestions_purpose_idx
  on public.ai_analysis_suggestions (matched_purpose_id)
  where matched_purpose_id is not null;

create index ai_analysis_suggestions_role_idx
  on public.ai_analysis_suggestions (matched_role_id)
  where matched_role_id is not null;
