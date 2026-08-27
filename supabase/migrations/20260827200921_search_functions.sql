create or replace function public.search_patents(
  p_query text default null,
  p_application_category_ids uuid[] default null,
  p_technical_purpose_ids uuid[] default null,
  p_chemical_ids uuid[] default null,
  p_country_codes text[] default null,
  p_favorite_only boolean default false,
  p_ai_analyzed_only boolean default false,
  p_archived boolean default false,
  p_cursor_uploaded_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  patent_number text,
  title text,
  country_code text,
  publication_date date,
  assignee text,
  summary text,
  favorite boolean,
  archived boolean,
  ai_analysis_status text,
  uploaded_at timestamptz,
  application_names text[],
  technical_purpose_names text[],
  material_names text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    patent.id,
    patent.patent_number,
    patent.title,
    patent.country_code,
    patent.publication_date,
    patent.assignee,
    coalesce(patent.user_summary, patent.ai_summary),
    patent.favorite,
    patent.archived,
    patent.ai_analysis_status,
    patent.uploaded_at,
    coalesce((
      select array_agg(category.name order by category.name)
      from public.patent_application_categories link
      join public.application_categories category on category.id = link.category_id
      where link.patent_id = patent.id
    ), '{}'),
    coalesce((
      select array_agg(purpose.name order by purpose.name)
      from public.patent_technical_purposes link
      join public.technical_purposes purpose on purpose.id = link.purpose_id
      where link.patent_id = patent.id
    ), '{}'),
    coalesce((
      select array_agg(
        distinct coalesce(chemical.abbreviation, chemical.canonical_name, product.trade_name, link.raw_material_name)
      )
      from public.patent_chemicals link
      left join public.chemicals chemical on chemical.id = link.chemical_id
      left join public.commercial_products product on product.id = link.commercial_product_id
      where link.patent_id = patent.id
    ), '{}')
  from public.patents patent
  where patent.owner_user_id = (select auth.uid())
    and patent.archived = p_archived
    and (
      nullif(btrim(p_query), '') is null
      or lower(coalesce(patent.title, '')) like '%' || lower(btrim(p_query)) || '%'
      or lower(coalesce(patent.patent_number, '')) like '%' || lower(btrim(p_query)) || '%'
      or lower(coalesce(patent.publication_number, '')) like '%' || lower(btrim(p_query)) || '%'
      or lower(coalesce(patent.assignee, '')) like '%' || lower(btrim(p_query)) || '%'
      or lower(coalesce(patent.abstract_text, '')) like '%' || lower(btrim(p_query)) || '%'
    )
    and (
      coalesce(cardinality(p_application_category_ids), 0) = 0
      or exists (
        select 1
        from public.patent_application_categories link
        where link.patent_id = patent.id
          and link.category_id = any(p_application_category_ids)
      )
    )
    and (
      coalesce(cardinality(p_technical_purpose_ids), 0) = 0
      or exists (
        select 1
        from public.patent_technical_purposes link
        where link.patent_id = patent.id
          and link.purpose_id = any(p_technical_purpose_ids)
      )
    )
    and (
      coalesce(cardinality(p_chemical_ids), 0) = 0
      or not exists (
        select 1
        from unnest(p_chemical_ids) as requested(chemical_id)
        where not exists (
          select 1
          from public.patent_chemicals link
          where link.patent_id = patent.id
            and (
              link.chemical_id = requested.chemical_id
              or exists (
                select 1
                from public.commercial_product_chemicals product_chemical
                where product_chemical.commercial_product_id = link.commercial_product_id
                  and product_chemical.chemical_id = requested.chemical_id
              )
            )
        )
      )
    )
    and (
      coalesce(cardinality(p_country_codes), 0) = 0
      or upper(patent.country_code) = any(
        select upper(country_code) from unnest(p_country_codes) as country_code
      )
    )
    and (not p_favorite_only or patent.favorite)
    and (
      not p_ai_analyzed_only
      or patent.ai_analysis_status in ('REVIEW_REQUIRED', 'COMPLETED')
    )
    and (
      p_cursor_uploaded_at is null
      or p_cursor_id is null
      or (patent.uploaded_at, patent.id) < (p_cursor_uploaded_at, p_cursor_id)
    )
  order by patent.uploaded_at desc, patent.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.search_patents(
  text, uuid[], uuid[], uuid[], text[], boolean, boolean, boolean, timestamptz, uuid, integer
) from public, anon;
grant execute on function public.search_patents(
  text, uuid[], uuid[], uuid[], text[], boolean, boolean, boolean, timestamptz, uuid, integer
) to authenticated, service_role;

create or replace function public.search_chemical_concepts(
  p_query text default null,
  p_limit integer default 30
)
returns table (
  chemical_id uuid,
  canonical_name text,
  abbreviation text,
  cas_number text,
  chemical_class text,
  synonyms text[],
  commercial_product_names text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    chemical.id,
    chemical.canonical_name,
    chemical.abbreviation,
    chemical.cas_number,
    chemical.chemical_class,
    coalesce((
      select array_agg(synonym.synonym order by synonym.synonym)
      from public.chemical_synonyms synonym
      where synonym.chemical_id = chemical.id
    ), '{}'),
    coalesce((
      select array_agg(product.trade_name order by product.trade_name)
      from public.commercial_product_chemicals mapping
      join public.commercial_products product on product.id = mapping.commercial_product_id
      where mapping.chemical_id = chemical.id
    ), '{}')
  from public.chemicals chemical
  where nullif(btrim(p_query), '') is null
    or lower(chemical.canonical_name) like '%' || lower(btrim(p_query)) || '%'
    or lower(coalesce(chemical.abbreviation, '')) like '%' || lower(btrim(p_query)) || '%'
    or lower(coalesce(chemical.cas_number, '')) like '%' || lower(btrim(p_query)) || '%'
    or exists (
      select 1
      from public.chemical_synonyms synonym
      where synonym.chemical_id = chemical.id
        and lower(synonym.synonym) like '%' || lower(btrim(p_query)) || '%'
    )
    or exists (
      select 1
      from public.commercial_product_chemicals mapping
      join public.commercial_products product on product.id = mapping.commercial_product_id
      where mapping.chemical_id = chemical.id
        and lower(product.trade_name) like '%' || lower(btrim(p_query)) || '%'
    )
  order by
    case
      when lower(chemical.canonical_name) = lower(btrim(coalesce(p_query, ''))) then 0
      when lower(coalesce(chemical.abbreviation, '')) = lower(btrim(coalesce(p_query, ''))) then 1
      else 2
    end,
    chemical.canonical_name
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

revoke all on function public.search_chemical_concepts(text, integer) from public, anon;
grant execute on function public.search_chemical_concepts(text, integer)
to authenticated, service_role;
