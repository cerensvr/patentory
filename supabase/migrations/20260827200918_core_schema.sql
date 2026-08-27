create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 160)
);

create table public.patents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  patent_number text,
  title text,
  publication_number text,
  application_number text,
  country_code text,
  publication_date date,
  priority_date date,
  filing_date date,
  assignee text,
  inventors text[] not null default '{}',
  language text,
  abstract_text text,
  notes text,
  pdf_storage_path text,
  pdf_original_filename text,
  pdf_size_bytes bigint,
  pdf_mime_type text,
  ai_analysis_status text not null default 'NOT_ANALYZED',
  ai_summary text,
  user_summary text,
  favorite boolean not null default false,
  archived boolean not null default false,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patents_country_code_length check (country_code is null or char_length(country_code) between 2 and 8),
  constraint patents_pdf_size_nonnegative check (pdf_size_bytes is null or pdf_size_bytes >= 0),
  constraint patents_pdf_mime_type check (pdf_mime_type is null or pdf_mime_type = 'application/pdf'),
  constraint patents_pdf_metadata_complete check (
    pdf_storage_path is null
    or (pdf_original_filename is not null and pdf_mime_type = 'application/pdf')
  ),
  constraint patents_ai_analysis_status check (
    ai_analysis_status in (
      'NOT_ANALYZED', 'QUEUED', 'PROCESSING',
      'REVIEW_REQUIRED', 'COMPLETED', 'FAILED'
    )
  )
);

create table public.application_categories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  parent_category_id uuid references public.application_categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_categories_name_not_blank check (btrim(name) <> ''),
  constraint application_categories_not_self_parent check (parent_category_id is null or parent_category_id <> id)
);

create table public.technical_purposes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid references public.technical_purposes(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technical_purposes_name_not_blank check (btrim(name) <> ''),
  constraint technical_purposes_not_self_parent check (parent_id is null or parent_id <> id)
);

create table public.chemicals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  canonical_name text not null,
  abbreviation text,
  cas_number text,
  molecular_formula text,
  smiles text,
  chemical_class text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chemicals_canonical_name_not_blank check (btrim(canonical_name) <> ''),
  constraint chemicals_abbreviation_not_blank check (abbreviation is null or btrim(abbreviation) <> ''),
  constraint chemicals_cas_number_not_blank check (cas_number is null or btrim(cas_number) <> '')
);

create table public.chemical_synonyms (
  id uuid primary key default gen_random_uuid(),
  chemical_id uuid not null references public.chemicals(id) on delete cascade,
  synonym text not null,
  created_at timestamptz not null default now(),
  constraint chemical_synonyms_not_blank check (btrim(synonym) <> '')
);

create table public.commercial_products (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  trade_name text not null,
  manufacturer text,
  description text,
  product_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_products_trade_name_not_blank check (btrim(trade_name) <> '')
);

create table public.commercial_product_chemicals (
  commercial_product_id uuid not null references public.commercial_products(id) on delete cascade,
  chemical_id uuid not null references public.chemicals(id) on delete restrict,
  concentration_min numeric,
  concentration_max numeric,
  concentration_unit text,
  created_at timestamptz not null default now(),
  primary key (commercial_product_id, chemical_id),
  constraint commercial_product_chemicals_min_nonnegative check (concentration_min is null or concentration_min >= 0),
  constraint commercial_product_chemicals_max_nonnegative check (concentration_max is null or concentration_max >= 0),
  constraint commercial_product_chemicals_valid_range check (
    concentration_min is null or concentration_max is null or concentration_min <= concentration_max
  ),
  constraint commercial_product_chemicals_unit_required check (
    (concentration_min is null and concentration_max is null)
    or (concentration_unit is not null and btrim(concentration_unit) <> '')
  )
);

create table public.chemical_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint chemical_roles_name_not_blank check (btrim(name) <> '')
);

create table public.patent_chemicals (
  id uuid primary key default gen_random_uuid(),
  patent_id uuid not null references public.patents(id) on delete cascade,
  chemical_id uuid references public.chemicals(id) on delete restrict,
  commercial_product_id uuid references public.commercial_products(id) on delete restrict,
  chemical_role_id uuid not null references public.chemical_roles(id) on delete restrict,
  raw_material_name text,
  confidence_score numeric(5,4),
  source_type text not null default 'MANUAL',
  ai_suggested boolean not null default false,
  user_confirmed boolean not null default false,
  source_page integer,
  source_section text,
  source_quote text,
  source_start_offset integer,
  source_end_offset integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patent_chemicals_material_present check (
    chemical_id is not null
    or commercial_product_id is not null
    or (raw_material_name is not null and btrim(raw_material_name) <> '')
  ),
  constraint patent_chemicals_confidence_range check (
    confidence_score is null or confidence_score between 0 and 1
  ),
  constraint patent_chemicals_source_type check (source_type in ('MANUAL', 'AI')),
  constraint patent_chemicals_source_page_positive check (source_page is null or source_page > 0),
  constraint patent_chemicals_source_offsets_nonnegative check (
    (source_start_offset is null or source_start_offset >= 0)
    and (source_end_offset is null or source_end_offset >= 0)
    and (
      source_start_offset is null
      or source_end_offset is null
      or source_start_offset <= source_end_offset
    )
  )
);

create table public.patent_application_categories (
  patent_id uuid not null references public.patents(id) on delete cascade,
  category_id uuid not null references public.application_categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (patent_id, category_id)
);

create table public.patent_technical_purposes (
  patent_id uuid not null references public.patents(id) on delete cascade,
  purpose_id uuid not null references public.technical_purposes(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (patent_id, purpose_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_name_not_blank check (btrim(name) <> '')
);

create table public.patent_tags (
  patent_id uuid not null references public.patents(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (patent_id, tag_id)
);

create unique index application_categories_shared_name_uq
  on public.application_categories (lower(name))
  where owner_user_id is null;
create unique index application_categories_owner_name_uq
  on public.application_categories (owner_user_id, lower(name))
  where owner_user_id is not null;
create index application_categories_owner_idx on public.application_categories (owner_user_id);
create index application_categories_parent_idx on public.application_categories (parent_category_id);

create unique index technical_purposes_shared_name_uq
  on public.technical_purposes (lower(name))
  where owner_user_id is null;
create unique index technical_purposes_owner_name_uq
  on public.technical_purposes (owner_user_id, lower(name))
  where owner_user_id is not null;
create index technical_purposes_owner_idx on public.technical_purposes (owner_user_id);
create index technical_purposes_parent_idx on public.technical_purposes (parent_id);

create unique index chemicals_shared_name_uq
  on public.chemicals (lower(canonical_name))
  where owner_user_id is null;
create unique index chemicals_owner_name_uq
  on public.chemicals (owner_user_id, lower(canonical_name))
  where owner_user_id is not null;
create unique index chemicals_shared_cas_uq
  on public.chemicals (lower(cas_number))
  where owner_user_id is null and cas_number is not null;
create unique index chemicals_owner_cas_uq
  on public.chemicals (owner_user_id, lower(cas_number))
  where owner_user_id is not null and cas_number is not null;
create index chemicals_owner_idx on public.chemicals (owner_user_id);
create index chemicals_canonical_name_trgm_idx
  on public.chemicals using gin (lower(canonical_name) extensions.gin_trgm_ops);
create index chemicals_abbreviation_trgm_idx
  on public.chemicals using gin (lower(abbreviation) extensions.gin_trgm_ops);

create unique index chemical_synonyms_chemical_synonym_uq
  on public.chemical_synonyms (chemical_id, lower(synonym));
create index chemical_synonyms_chemical_idx on public.chemical_synonyms (chemical_id);
create index chemical_synonyms_synonym_trgm_idx
  on public.chemical_synonyms using gin (lower(synonym) extensions.gin_trgm_ops);

create unique index commercial_products_shared_name_uq
  on public.commercial_products (lower(trade_name), lower(coalesce(manufacturer, '')))
  where owner_user_id is null;
create unique index commercial_products_owner_name_uq
  on public.commercial_products (owner_user_id, lower(trade_name), lower(coalesce(manufacturer, '')))
  where owner_user_id is not null;
create index commercial_products_owner_idx on public.commercial_products (owner_user_id);
create index commercial_products_trade_name_trgm_idx
  on public.commercial_products using gin (lower(trade_name) extensions.gin_trgm_ops);
create index commercial_product_chemicals_chemical_idx
  on public.commercial_product_chemicals (chemical_id, commercial_product_id);

create unique index chemical_roles_name_uq on public.chemical_roles (lower(name));

create index patents_owner_uploaded_idx
  on public.patents (owner_user_id, uploaded_at desc, id desc);
create index patents_owner_archived_uploaded_idx
  on public.patents (owner_user_id, archived, uploaded_at desc, id desc);
create index patents_owner_favorite_idx
  on public.patents (owner_user_id, favorite)
  where favorite = true;
create index patents_title_trgm_idx
  on public.patents using gin (lower(title) extensions.gin_trgm_ops);
create index patents_patent_number_trgm_idx
  on public.patents using gin (lower(patent_number) extensions.gin_trgm_ops);
create index patents_assignee_trgm_idx
  on public.patents using gin (lower(assignee) extensions.gin_trgm_ops);

create index patent_chemicals_patent_idx on public.patent_chemicals (patent_id);
create index patent_chemicals_chemical_patent_idx on public.patent_chemicals (chemical_id, patent_id);
create index patent_chemicals_product_patent_idx on public.patent_chemicals (commercial_product_id, patent_id);
create index patent_chemicals_role_idx on public.patent_chemicals (chemical_role_id);
create index patent_application_categories_category_idx
  on public.patent_application_categories (category_id, patent_id);
create index patent_technical_purposes_purpose_idx
  on public.patent_technical_purposes (purpose_id, patent_id);
create unique index tags_owner_name_uq on public.tags (owner_user_id, lower(name));
create index patent_tags_tag_idx on public.patent_tags (tag_id, patent_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger patents_set_updated_at
before update on public.patents
for each row execute function private.set_updated_at();

create trigger application_categories_set_updated_at
before update on public.application_categories
for each row execute function private.set_updated_at();

create trigger technical_purposes_set_updated_at
before update on public.technical_purposes
for each row execute function private.set_updated_at();

create trigger chemicals_set_updated_at
before update on public.chemicals
for each row execute function private.set_updated_at();

create trigger commercial_products_set_updated_at
before update on public.commercial_products
for each row execute function private.set_updated_at();

create trigger patent_chemicals_set_updated_at
before update on public.patent_chemicals
for each row execute function private.set_updated_at();

create trigger tags_set_updated_at
before update on public.tags
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''));
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();
