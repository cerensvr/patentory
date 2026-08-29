begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select cmp_ok(
  (select count(*)::integer from public.chemicals where owner_user_id is null),
  '>=', 29,
  'shared chemistry catalog contains the expanded 29-record baseline'
);

select cmp_ok(
  (select count(*)::integer from public.chemicals where owner_user_id is null and (chemical_class ilike '%epoxy%' or chemical_class ilike '%glycidyl%')),
  '>=', 9,
  'catalog contains at least nine epoxy resin or reactive-diluent records'
);

select cmp_ok(
  (select count(*)::integer from public.chemicals where owner_user_id is null and chemical_class ilike '%amine%'),
  '>=', 9,
  'catalog contains at least nine amine hardeners'
);

select cmp_ok(
  (select count(*)::integer from public.chemicals where owner_user_id is null and (chemical_class ilike '%latent%' or chemical_class ilike '%imidazole%' or chemical_class ilike '%accelerator%' or chemical_class ilike '%catalyst%')),
  '>=', 5,
  'catalog contains at least five latent hardener or accelerator records'
);

select cmp_ok(
  (select count(*)::integer from public.chemicals where owner_user_id is null and chemical_class ilike '%anhydride%'),
  '>=', 2,
  'catalog contains anhydride hardeners'
);

select cmp_ok(
  (select count(*)::integer from public.chemicals where owner_user_id is null and chemical_class ilike '%thiol%'),
  '>=', 2,
  'catalog contains thiol hardeners'
);

select is(
  (select abbreviation from public.search_chemical_concepts('TGMDA', 10) limit 1),
  'TGDDM',
  'TGMDA synonym resolves to canonical TGDDM'
);

select ok(
  exists (
    select 1
    from public.commercial_products product
    join public.commercial_product_chemicals mapping on mapping.commercial_product_id = product.id
    join public.chemicals chemical on chemical.id = mapping.chemical_id
    where product.trade_name = 'VESTAMIN PACM' and chemical.abbreviation = 'PACM'
  ),
  'VESTAMIN PACM has an explicit PACM mapping'
);

select ok(
  exists (
    select 1
    from public.commercial_products product
    join public.commercial_product_chemicals mapping on mapping.commercial_product_id = product.id
    join public.chemicals chemical on chemical.id = mapping.chemical_id
    where product.trade_name = 'ANCAMINE K54' and chemical.abbreviation = 'DMP-30'
  ),
  'ANCAMINE K54 has an explicit DMP-30 mapping'
);

select is(
  (
    select count(*)::integer
    from public.commercial_product_chemicals mapping
    join public.commercial_products product on product.id = mapping.commercial_product_id
    where product.trade_name = 'JEFFAMINE D-230'
  ),
  0,
  'JEFFAMINE D-230 is not collapsed into one pure chemical'
);

select * from finish();
rollback;
