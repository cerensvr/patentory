-- Curated from PubChem PUG REST on 2026-08-29.
-- PubChem synonym responses also contain trade names, supplier codes, registry
-- identifiers, and formulations. Only unambiguous chemical-name variants are
-- imported here; commercial names remain in commercial_products.

insert into public.chemical_synonyms (chemical_id, synonym)
select chemical_id, synonym
from (values
  -- Isophorone diamine (PubChem CID 17857)
  ('40000000-0000-4000-8000-000000000001'::uuid, '3-(aminomethyl)-3,5,5-trimethylcyclohexan-1-amine'),
  ('40000000-0000-4000-8000-000000000001'::uuid, 'Cyclohexanemethanamine, 5-amino-1,3,3-trimethyl-'),
  ('40000000-0000-4000-8000-000000000001'::uuid, '5-Amino-1,3,3-trimethylcyclohexanemethylamine'),
  ('40000000-0000-4000-8000-000000000001'::uuid, '3-(Aminomethyl)-3,5,5-trimethylcyclohexanamine'),

  -- Bisphenol A diglycidyl ether (PubChem CID 2286)
  ('40000000-0000-4000-8000-000000000002'::uuid, 'BADGE'),
  ('40000000-0000-4000-8000-000000000002'::uuid, 'DGEBPA'),
  ('40000000-0000-4000-8000-000000000002'::uuid, '2,2-Bis(4-glycidyloxyphenyl)propane'),
  ('40000000-0000-4000-8000-000000000002'::uuid, 'Diglycidyl bisphenol A'),
  ('40000000-0000-4000-8000-000000000002'::uuid, 'Diglycidyl bisphenol A ether'),
  ('40000000-0000-4000-8000-000000000002'::uuid, 'Diglycidyl ether of bisphenol A'),
  ('40000000-0000-4000-8000-000000000002'::uuid, 'Dian diglycidyl ether'),
  ('40000000-0000-4000-8000-000000000002'::uuid, '2,2-Bis(p-glycidyloxyphenyl)propane'),
  ('40000000-0000-4000-8000-000000000002'::uuid, '4,4-Isopropylidenediphenol diglycidyl ether'),
  ('40000000-0000-4000-8000-000000000002'::uuid, 'Bis(4-glycidyloxyphenyl)dimethylmethane'),
  ('40000000-0000-4000-8000-000000000002'::uuid, '2-[[4-[2-[4-(oxiran-2-ylmethoxy)phenyl]propan-2-yl]phenoxy]methyl]oxirane'),

  -- Sodium bicarbonate (PubChem CID 516892)
  ('40000000-0000-4000-8000-000000000005'::uuid, 'Sodium hydrogen carbonate'),
  ('40000000-0000-4000-8000-000000000005'::uuid, 'Sodium hydrogencarbonate'),
  ('40000000-0000-4000-8000-000000000005'::uuid, 'Sodium acid carbonate'),
  ('40000000-0000-4000-8000-000000000005'::uuid, 'Bicarbonate of soda'),
  ('40000000-0000-4000-8000-000000000005'::uuid, 'Carbonic acid monosodium salt'),
  ('40000000-0000-4000-8000-000000000005'::uuid, 'Monosodium carbonate'),
  ('40000000-0000-4000-8000-000000000005'::uuid, 'Baking soda'),

  -- Diethylenetriamine (PubChem CID 8111)
  ('40000000-0000-4000-8000-000000000006'::uuid, 'Bis(2-aminoethyl)amine'),
  ('40000000-0000-4000-8000-000000000006'::uuid, '2,2-Diaminodiethylamine'),
  ('40000000-0000-4000-8000-000000000006'::uuid, '1,4,7-Triazaheptane'),
  ('40000000-0000-4000-8000-000000000006'::uuid, 'Diethylene triamine'),
  ('40000000-0000-4000-8000-000000000006'::uuid, '3-Azapentane-1,5-diamine'),
  ('40000000-0000-4000-8000-000000000006'::uuid, '1,5-Diamino-3-azapentane'),
  ('40000000-0000-4000-8000-000000000006'::uuid, 'N-(2-Aminoethyl)-1,2-ethanediamine'),
  ('40000000-0000-4000-8000-000000000006'::uuid, 'N''-(2-aminoethyl)ethane-1,2-diamine'),

  -- Triethylenetetramine (PubChem CID 5565)
  ('40000000-0000-4000-8000-000000000007'::uuid, 'Triethylene tetramine'),
  ('40000000-0000-4000-8000-000000000007'::uuid, 'Triethylene tetraamine'),
  ('40000000-0000-4000-8000-000000000007'::uuid, '1,4,7,10-Tetraazadecane'),
  ('40000000-0000-4000-8000-000000000007'::uuid, '1,8-Diamino-3,6-diazaoctane'),
  ('40000000-0000-4000-8000-000000000007'::uuid, '3,6-Diazaoctane-1,8-diamine'),
  ('40000000-0000-4000-8000-000000000007'::uuid, 'N,N''-Bis(2-aminoethyl)-1,2-ethanediamine'),
  ('40000000-0000-4000-8000-000000000007'::uuid, 'N''-[2-(2-aminoethylamino)ethyl]ethane-1,2-diamine')
) as pubchem_synonyms(chemical_id, synonym)
on conflict do nothing;
