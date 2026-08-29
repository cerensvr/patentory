-- Commercial/trade names curated from PubChem PUG REST synonym results on
-- 2026-08-29. These stay separate from chemical_synonyms. UNKNOWN is deliberate:
-- a named grade may be a pure substance, a mixture, or a formulation, and must
-- not be treated as pure without manufacturer evidence.

insert into public.commercial_products (
  id, owner_user_id, trade_name, manufacturer, description, product_type, notes
) values
  ('60000000-0000-4000-8000-000000000010', null, 'Araldite HY 5083', null, 'PubChem lists this commercial name with isophorone diamine.', 'UNKNOWN', 'Composition and manufacturer grade must be verified before treating it as a pure substance.'),
  ('60000000-0000-4000-8000-000000000011', null, 'Luxam IPD', null, 'PubChem lists this commercial name with isophorone diamine.', 'UNKNOWN', 'Composition and manufacturer grade must be verified before treating it as a pure substance.'),
  ('60000000-0000-4000-8000-000000000020', null, 'Epophen EL 5', null, 'PubChem lists this commercial name with bisphenol A diglycidyl ether.', 'UNKNOWN', 'Commercial epoxy grade; composition and oligomer distribution must be verified.'),
  ('60000000-0000-4000-8000-000000000021', null, 'Epi-Rez 510', null, 'PubChem lists this commercial name with bisphenol A diglycidyl ether.', 'UNKNOWN', 'Commercial epoxy grade; composition and oligomer distribution must be verified.'),
  ('60000000-0000-4000-8000-000000000030', null, 'Barsamide 115', null, 'PubChem lists this commercial name with diethylenetriamine.', 'UNKNOWN', 'Commercial hardener grade; formulation must be verified.'),
  ('60000000-0000-4000-8000-000000000031', null, 'Epicure T', null, 'PubChem lists this commercial name with diethylenetriamine.', 'UNKNOWN', 'Commercial hardener grade; formulation must be verified.'),
  ('60000000-0000-4000-8000-000000000032', null, 'Ancamine DETA', null, 'PubChem lists this commercial name with diethylenetriamine.', 'UNKNOWN', 'Commercial hardener grade; formulation must be verified.'),
  ('60000000-0000-4000-8000-000000000040', null, 'Araldite HY 951', null, 'PubChem lists this commercial name with triethylenetetramine.', 'UNKNOWN', 'Commercial hardener grade; formulation must be verified.'),
  ('60000000-0000-4000-8000-000000000041', null, 'DEH 24', null, 'PubChem lists this commercial name with triethylenetetramine.', 'UNKNOWN', 'Commercial hardener grade; formulation must be verified.')
on conflict (id) do nothing;

insert into public.commercial_product_chemicals (commercial_product_id, chemical_id)
values
  ('60000000-0000-4000-8000-000000000010', '40000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000020', '40000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000021', '40000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000030', '40000000-0000-4000-8000-000000000006'),
  ('60000000-0000-4000-8000-000000000031', '40000000-0000-4000-8000-000000000006'),
  ('60000000-0000-4000-8000-000000000032', '40000000-0000-4000-8000-000000000006'),
  ('60000000-0000-4000-8000-000000000040', '40000000-0000-4000-8000-000000000007'),
  ('60000000-0000-4000-8000-000000000041', '40000000-0000-4000-8000-000000000007')
on conflict (commercial_product_id, chemical_id) do nothing;
