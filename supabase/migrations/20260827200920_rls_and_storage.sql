revoke all on table
  public.profiles,
  public.patents,
  public.application_categories,
  public.technical_purposes,
  public.chemicals,
  public.chemical_synonyms,
  public.commercial_products,
  public.commercial_product_chemicals,
  public.chemical_roles,
  public.patent_chemicals,
  public.patent_application_categories,
  public.patent_technical_purposes,
  public.tags,
  public.patent_tags
from anon;

grant usage on schema public to authenticated, service_role;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.patents to authenticated;
grant select, insert, update, delete on table
  public.application_categories,
  public.technical_purposes,
  public.chemicals,
  public.chemical_synonyms,
  public.commercial_products,
  public.commercial_product_chemicals,
  public.patent_chemicals,
  public.patent_application_categories,
  public.patent_technical_purposes,
  public.tags,
  public.patent_tags
to authenticated;
grant select on table public.chemical_roles to authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.patents,
  public.application_categories,
  public.technical_purposes,
  public.chemicals,
  public.chemical_synonyms,
  public.commercial_products,
  public.commercial_product_chemicals,
  public.chemical_roles,
  public.patent_chemicals,
  public.patent_application_categories,
  public.patent_technical_purposes,
  public.tags,
  public.patent_tags
to service_role;

alter table public.profiles enable row level security;
alter table public.patents enable row level security;
alter table public.application_categories enable row level security;
alter table public.technical_purposes enable row level security;
alter table public.chemicals enable row level security;
alter table public.chemical_synonyms enable row level security;
alter table public.commercial_products enable row level security;
alter table public.commercial_product_chemicals enable row level security;
alter table public.chemical_roles enable row level security;
alter table public.patent_chemicals enable row level security;
alter table public.patent_application_categories enable row level security;
alter table public.patent_technical_purposes enable row level security;
alter table public.tags enable row level security;
alter table public.patent_tags enable row level security;

create policy profiles_select_own
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy patents_select_own
on public.patents for select
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy patents_insert_own
on public.patents for insert
to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy patents_update_own
on public.patents for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy patents_delete_own
on public.patents for delete
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy application_categories_select_visible
on public.application_categories for select
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id);

create policy application_categories_insert_own
on public.application_categories for insert
to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy application_categories_update_own
on public.application_categories for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy application_categories_delete_own
on public.application_categories for delete
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy technical_purposes_select_visible
on public.technical_purposes for select
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id);

create policy technical_purposes_insert_own
on public.technical_purposes for insert
to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy technical_purposes_update_own
on public.technical_purposes for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy technical_purposes_delete_own
on public.technical_purposes for delete
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy chemicals_select_visible
on public.chemicals for select
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id);

create policy chemicals_insert_own
on public.chemicals for insert
to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy chemicals_update_own
on public.chemicals for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy chemicals_delete_own
on public.chemicals for delete
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy chemical_synonyms_select_visible
on public.chemical_synonyms for select
to authenticated
using (
  exists (
    select 1
    from public.chemicals chemical
    where chemical.id = chemical_synonyms.chemical_id
      and (chemical.owner_user_id is null or chemical.owner_user_id = (select auth.uid()))
  )
);

create policy chemical_synonyms_insert_for_owned_chemical
on public.chemical_synonyms for insert
to authenticated
with check (
  exists (
    select 1
    from public.chemicals chemical
    where chemical.id = chemical_synonyms.chemical_id
      and chemical.owner_user_id = (select auth.uid())
  )
);

create policy chemical_synonyms_update_for_owned_chemical
on public.chemical_synonyms for update
to authenticated
using (
  exists (
    select 1
    from public.chemicals chemical
    where chemical.id = chemical_synonyms.chemical_id
      and chemical.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.chemicals chemical
    where chemical.id = chemical_synonyms.chemical_id
      and chemical.owner_user_id = (select auth.uid())
  )
);

create policy chemical_synonyms_delete_for_owned_chemical
on public.chemical_synonyms for delete
to authenticated
using (
  exists (
    select 1
    from public.chemicals chemical
    where chemical.id = chemical_synonyms.chemical_id
      and chemical.owner_user_id = (select auth.uid())
  )
);

create policy commercial_products_select_visible
on public.commercial_products for select
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id);

create policy commercial_products_insert_own
on public.commercial_products for insert
to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy commercial_products_update_own
on public.commercial_products for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy commercial_products_delete_own
on public.commercial_products for delete
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy commercial_product_chemicals_select_visible
on public.commercial_product_chemicals for select
to authenticated
using (
  exists (
    select 1
    from public.commercial_products product
    where product.id = commercial_product_chemicals.commercial_product_id
      and (product.owner_user_id is null or product.owner_user_id = (select auth.uid()))
  )
  and exists (
    select 1
    from public.chemicals chemical
    where chemical.id = commercial_product_chemicals.chemical_id
      and (chemical.owner_user_id is null or chemical.owner_user_id = (select auth.uid()))
  )
);

create policy commercial_product_chemicals_insert_for_owned_product
on public.commercial_product_chemicals for insert
to authenticated
with check (
  exists (
    select 1
    from public.commercial_products product
    where product.id = commercial_product_chemicals.commercial_product_id
      and product.owner_user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.chemicals chemical
    where chemical.id = commercial_product_chemicals.chemical_id
      and (chemical.owner_user_id is null or chemical.owner_user_id = (select auth.uid()))
  )
);

create policy commercial_product_chemicals_update_for_owned_product
on public.commercial_product_chemicals for update
to authenticated
using (
  exists (
    select 1
    from public.commercial_products product
    where product.id = commercial_product_chemicals.commercial_product_id
      and product.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.commercial_products product
    where product.id = commercial_product_chemicals.commercial_product_id
      and product.owner_user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.chemicals chemical
    where chemical.id = commercial_product_chemicals.chemical_id
      and (chemical.owner_user_id is null or chemical.owner_user_id = (select auth.uid()))
  )
);

create policy commercial_product_chemicals_delete_for_owned_product
on public.commercial_product_chemicals for delete
to authenticated
using (
  exists (
    select 1
    from public.commercial_products product
    where product.id = commercial_product_chemicals.commercial_product_id
      and product.owner_user_id = (select auth.uid())
  )
);

create policy chemical_roles_select_authenticated
on public.chemical_roles for select
to authenticated
using (true);

create policy patent_chemicals_select_own_patent
on public.patent_chemicals for select
to authenticated
using (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_chemicals.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
);

create policy patent_chemicals_insert_own_patent
on public.patent_chemicals for insert
to authenticated
with check (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_chemicals.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
  and (
    chemical_id is null
    or exists (
      select 1 from public.chemicals chemical
      where chemical.id = patent_chemicals.chemical_id
        and (chemical.owner_user_id is null or chemical.owner_user_id = (select auth.uid()))
    )
  )
  and (
    commercial_product_id is null
    or exists (
      select 1 from public.commercial_products product
      where product.id = patent_chemicals.commercial_product_id
        and (product.owner_user_id is null or product.owner_user_id = (select auth.uid()))
    )
  )
);

create policy patent_chemicals_update_own_patent
on public.patent_chemicals for update
to authenticated
using (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_chemicals.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_chemicals.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
  and (
    chemical_id is null
    or exists (
      select 1 from public.chemicals chemical
      where chemical.id = patent_chemicals.chemical_id
        and (chemical.owner_user_id is null or chemical.owner_user_id = (select auth.uid()))
    )
  )
  and (
    commercial_product_id is null
    or exists (
      select 1 from public.commercial_products product
      where product.id = patent_chemicals.commercial_product_id
        and (product.owner_user_id is null or product.owner_user_id = (select auth.uid()))
    )
  )
);

create policy patent_chemicals_delete_own_patent
on public.patent_chemicals for delete
to authenticated
using (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_chemicals.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
);

create policy patent_application_categories_select_own_patent
on public.patent_application_categories for select
to authenticated
using (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_application_categories.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
);

create policy patent_application_categories_insert_own_patent
on public.patent_application_categories for insert
to authenticated
with check (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_application_categories.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.application_categories category
    where category.id = patent_application_categories.category_id
      and (category.owner_user_id is null or category.owner_user_id = (select auth.uid()))
  )
);

create policy patent_application_categories_delete_own_patent
on public.patent_application_categories for delete
to authenticated
using (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_application_categories.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
);

create policy patent_technical_purposes_select_own_patent
on public.patent_technical_purposes for select
to authenticated
using (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_technical_purposes.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
);

create policy patent_technical_purposes_insert_own_patent
on public.patent_technical_purposes for insert
to authenticated
with check (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_technical_purposes.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.technical_purposes purpose
    where purpose.id = patent_technical_purposes.purpose_id
      and (purpose.owner_user_id is null or purpose.owner_user_id = (select auth.uid()))
  )
);

create policy patent_technical_purposes_delete_own_patent
on public.patent_technical_purposes for delete
to authenticated
using (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_technical_purposes.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
);

create policy tags_select_own
on public.tags for select
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy tags_insert_own
on public.tags for insert
to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy tags_update_own
on public.tags for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy tags_delete_own
on public.tags for delete
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy patent_tags_select_own
on public.patent_tags for select
to authenticated
using (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_tags.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.tags tag
    where tag.id = patent_tags.tag_id
      and tag.owner_user_id = (select auth.uid())
  )
);

create policy patent_tags_insert_own
on public.patent_tags for insert
to authenticated
with check (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_tags.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.tags tag
    where tag.id = patent_tags.tag_id
      and tag.owner_user_id = (select auth.uid())
  )
);

create policy patent_tags_delete_own
on public.patent_tags for delete
to authenticated
using (
  exists (
    select 1 from public.patents patent
    where patent.id = patent_tags.patent_id
      and patent.owner_user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.tags tag
    where tag.id = patent_tags.tag_id
      and tag.owner_user_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patent-pdfs', 'patent-pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy patent_pdfs_select_own
on storage.objects for select
to authenticated
using (
  bucket_id = 'patent-pdfs'
  and cardinality(storage.foldername(name)) = 2
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.patents patent
    where patent.owner_user_id = (select auth.uid())
      and patent.id::text = (storage.foldername(name))[2]
  )
);

create policy patent_pdfs_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'patent-pdfs'
  and cardinality(storage.foldername(name)) = 2
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.extension(name) = 'pdf'
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  and exists (
    select 1 from public.patents patent
    where patent.owner_user_id = (select auth.uid())
      and patent.id::text = (storage.foldername(name))[2]
  )
);

create policy patent_pdfs_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'patent-pdfs'
  and cardinality(storage.foldername(name)) = 2
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.patents patent
    where patent.owner_user_id = (select auth.uid())
      and patent.id::text = (storage.foldername(name))[2]
  )
);
