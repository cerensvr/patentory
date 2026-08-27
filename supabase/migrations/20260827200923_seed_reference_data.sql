insert into public.chemical_roles (id, name) values
  ('10000000-0000-4000-8000-000000000001', 'Epoxy Resin'),
  ('10000000-0000-4000-8000-000000000002', 'Hardener'),
  ('10000000-0000-4000-8000-000000000003', 'Accelerator'),
  ('10000000-0000-4000-8000-000000000004', 'Catalyst'),
  ('10000000-0000-4000-8000-000000000005', 'Reactive Diluent'),
  ('10000000-0000-4000-8000-000000000006', 'Blowing Agent'),
  ('10000000-0000-4000-8000-000000000007', 'Surfactant'),
  ('10000000-0000-4000-8000-000000000008', 'Filler'),
  ('10000000-0000-4000-8000-000000000009', 'Flame Retardant'),
  ('10000000-0000-4000-8000-000000000010', 'Additive')
on conflict (id) do nothing;

insert into public.application_categories (id, owner_user_id, name) values
  ('20000000-0000-4000-8000-000000000001', null, 'Epoxy Foam'),
  ('20000000-0000-4000-8000-000000000002', null, 'Coating'),
  ('20000000-0000-4000-8000-000000000003', null, 'Adhesive'),
  ('20000000-0000-4000-8000-000000000004', null, 'Laminating Resin'),
  ('20000000-0000-4000-8000-000000000005', null, 'Composite'),
  ('20000000-0000-4000-8000-000000000006', null, 'Casting Resin'),
  ('20000000-0000-4000-8000-000000000007', null, 'Potting'),
  ('20000000-0000-4000-8000-000000000008', null, 'Prepreg')
on conflict (id) do nothing;

insert into public.technical_purposes (id, owner_user_id, name) values
  ('30000000-0000-4000-8000-000000000001', null, 'Low Viscosity'),
  ('30000000-0000-4000-8000-000000000002', null, 'Low Exotherm'),
  ('30000000-0000-4000-8000-000000000003', null, 'Low Density'),
  ('30000000-0000-4000-8000-000000000004', null, 'High Tg'),
  ('30000000-0000-4000-8000-000000000005', null, 'Long Pot Life'),
  ('30000000-0000-4000-8000-000000000006', null, 'Fast Cure'),
  ('30000000-0000-4000-8000-000000000007', null, 'Flame Retardancy'),
  ('30000000-0000-4000-8000-000000000008', null, 'Chemical Resistance'),
  ('30000000-0000-4000-8000-000000000009', null, 'Water Resistance'),
  ('30000000-0000-4000-8000-000000000010', null, 'High Adhesion')
on conflict (id) do nothing;

insert into public.chemicals (
  id, owner_user_id, canonical_name, abbreviation, cas_number, molecular_formula, chemical_class
) values
  (
    '40000000-0000-4000-8000-000000000001', null,
    'Isophorone diamine', 'IPDA', '2855-13-2', 'C10H22N2', 'Cycloaliphatic amine'
  ),
  (
    '40000000-0000-4000-8000-000000000002', null,
    'Bisphenol A diglycidyl ether', 'DGEBA', '1675-54-3', 'C21H24O4', 'Bisphenol-A epoxy'
  ),
  (
    '40000000-0000-4000-8000-000000000003', null,
    'Bisphenol F diglycidyl ether', 'DGEBF', null, null, 'Bisphenol-F epoxy'
  ),
  (
    '40000000-0000-4000-8000-000000000004', null,
    'Polymethylhydrosiloxane', 'PMHS', '63148-57-2', null, 'Siloxane-based blowing agent'
  ),
  (
    '40000000-0000-4000-8000-000000000005', null,
    'Sodium bicarbonate', 'NaHCO3', '144-55-8', 'NaHCO3', 'Chemical blowing agent'
  ),
  (
    '40000000-0000-4000-8000-000000000006', null,
    'Diethylenetriamine', 'DETA', '111-40-0', 'C4H13N3', 'Aliphatic amine'
  ),
  (
    '40000000-0000-4000-8000-000000000007', null,
    'Triethylenetetramine', 'TETA', '112-24-3', 'C6H18N4', 'Aliphatic amine'
  )
on conflict (id) do nothing;

insert into public.chemical_synonyms (id, chemical_id, synonym) values
  (
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'Isophoronediamine'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '3-aminomethyl-3,5,5-trimethylcyclohexylamine'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000002',
    'Bisphenol A epoxy resin'
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000004',
    'Poly(methylhydrosiloxane)'
  )
on conflict (id) do nothing;

insert into public.commercial_products (
  id, owner_user_id, trade_name, manufacturer, description, product_type
) values (
  '60000000-0000-4000-8000-000000000001',
  null,
  'VESTAMIN IPD',
  'Evonik',
  'Commercial cycloaliphatic diamine product mapped explicitly to IPDA.',
  'PURE_CHEMICAL'
)
on conflict (id) do nothing;

insert into public.commercial_product_chemicals (
  commercial_product_id,
  chemical_id,
  concentration_min,
  concentration_max,
  concentration_unit
) values (
  '60000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  null,
  null,
  null
)
on conflict (commercial_product_id, chemical_id) do nothing;
