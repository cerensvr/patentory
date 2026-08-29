-- Curated epoxy resin, reactive diluent, hardener, and accelerator catalog.
-- Substance identifiers were verified against PubChem PUG REST on 2026-08-29.
-- Commercial grades remain separate from canonical chemicals; mappings below
-- are added only where the manufacturer identifies the underlying substance.

update public.chemicals
set cas_number = '2095-03-6',
    molecular_formula = 'C19H20O4',
    smiles = 'C1C(O1)COC2=CC=C(C=C2)CC3=CC=C(C=C3)OCC4CO4',
    chemical_class = 'Bisphenol-F epoxy',
    notes = 'Substance-level DGEBF record; a commercial epoxy resin grade may contain an oligomer or isomer distribution.'
where id = '40000000-0000-4000-8000-000000000003';

insert into public.chemicals (
  id, owner_user_id, canonical_name, abbreviation, cas_number,
  molecular_formula, smiles, chemical_class, notes
) values
  ('40000000-0000-4000-8000-000000000008', null, 'Triglycidyl isocyanurate', 'TGIC', '2451-62-9', 'C12H15N3O6', 'C1C(O1)CN2C(=O)N(C(=O)N(C2=O)CC3CO3)CC4CO4', 'Trifunctional epoxy', 'Multifunctional epoxy substance; do not merge with a commercial powder-coating grade.'),
  ('40000000-0000-4000-8000-000000000009', null, 'Tetraglycidyl 4,4''-diaminodiphenylmethane', 'TGDDM', '28768-32-3', 'C25H30N2O4', 'C1C(O1)CN(CC2CO2)C3=CC=C(C=C3)CC4=CC=C(C=C4)N(CC5CO5)CC6CO6', 'Tetrafunctional aromatic epoxy', 'Also abbreviated TGMDA in patent literature.'),
  ('40000000-0000-4000-8000-000000000010', null, '3,4-Epoxycyclohexylmethyl 3,4-epoxycyclohexanecarboxylate', 'ECC', '2386-87-0', 'C14H20O4', 'C1CC2C(O2)CC1COC(=O)C3CCC4C(C3)O4', 'Cycloaliphatic epoxy', 'Canonical substance record; commercial cycloaliphatic epoxy grades stay separate.'),
  ('40000000-0000-4000-8000-000000000011', null, '1,4-Butanediol diglycidyl ether', 'BDDGE', '2425-79-8', 'C10H18O4', 'C1C(O1)COCCCCOCC2CO2', 'Aliphatic diglycidyl ether', 'Common difunctional reactive diluent for epoxy formulations.'),
  ('40000000-0000-4000-8000-000000000012', null, '1,6-Hexanediol diglycidyl ether', 'HDDGE', '16096-31-4', 'C12H22O4', 'C1C(O1)COCCCCCCOCC2CO2', 'Aliphatic diglycidyl ether', 'Common difunctional reactive diluent for epoxy formulations.'),
  ('40000000-0000-4000-8000-000000000013', null, 'Neopentyl glycol diglycidyl ether', 'NPGDGE', '17557-23-2', 'C11H20O4', 'CC(C)(COCC1CO1)COCC2CO2', 'Aliphatic diglycidyl ether', 'Common difunctional reactive diluent for epoxy formulations.'),
  ('40000000-0000-4000-8000-000000000014', null, 'Phenyl glycidyl ether', 'PGE', '122-60-1', 'C9H10O2', 'C1C(O1)COC2=CC=CC=C2', 'Monofunctional glycidyl ether', 'Reactive diluent substance; retain safety review outside Patentory.'),
  ('40000000-0000-4000-8000-000000000015', null, 'Ethylenediamine', 'EDA', '107-15-3', 'C2H8N2', 'C(CN)N', 'Aliphatic amine hardener', 'Small-molecule aliphatic diamine used in epoxy curing chemistry.'),
  ('40000000-0000-4000-8000-000000000016', null, 'N-(2-Aminoethyl)piperazine', 'AEP', '140-31-8', 'C6H15N3', 'C1CN(CCN1)CCN', 'Cycloaliphatic amine hardener', 'Amine curing-agent substance, also called aminoethylpiperazine.'),
  ('40000000-0000-4000-8000-000000000017', null, '4,4''-Diaminodicyclohexylmethane', 'PACM', '1761-71-3', 'C13H26N2', 'C1CC(CCC1CC2CCC(CC2)N)N', 'Cycloaliphatic amine hardener', 'Stereoisomer distribution may vary by commercial grade.'),
  ('40000000-0000-4000-8000-000000000018', null, '1,3-Benzenedimethanamine', 'MXDA', '1477-55-0', 'C8H12N2', 'C1=CC(=CC(=C1)CN)CN', 'Aromatic amine hardener', 'Commonly called meta-xylylenediamine in epoxy literature.'),
  ('40000000-0000-4000-8000-000000000019', null, '4,4''-Diaminodiphenyl sulfone', 'DDS', '80-08-0', 'C12H12N2O2S', 'C1=CC(=CC=C1N)S(=O)(=O)C2=CC=C(C=C2)N', 'Aromatic amine hardener', 'High-temperature aromatic diamine curing-agent substance.'),
  ('40000000-0000-4000-8000-000000000020', null, '4,4''-Methylenedianiline', 'MDA', '101-77-9', 'C13H14N2', 'C1=CC(=CC=C1CC2=CC=C(C=C2)N)N', 'Aromatic amine hardener', 'Aromatic diamine curing-agent substance; retain safety review outside Patentory.'),
  ('40000000-0000-4000-8000-000000000021', null, 'Dicyandiamide', 'DICY', '461-58-5', 'C2H4N4', 'C(#N)N=C(N)N', 'Latent guanidine hardener', 'Latent heat-activated epoxy curing agent.'),
  ('40000000-0000-4000-8000-000000000022', null, '2-Methylimidazole', '2MI', '693-98-1', 'C4H6N2', 'CC1=NC=CN1', 'Imidazole accelerator', 'Epoxy curing accelerator and catalyst substance.'),
  ('40000000-0000-4000-8000-000000000023', null, '2-Ethyl-4-methylimidazole', '2E4MI', '931-36-2', 'C6H10N2', 'CCC1=NC=C(N1)C', 'Imidazole accelerator', 'Epoxy curing accelerator and catalyst substance.'),
  ('40000000-0000-4000-8000-000000000024', null, 'Hexahydrophthalic anhydride', 'HHPA', '85-42-7', 'C8H10O3', 'C1CCC2C(C1)C(=O)OC2=O', 'Cyclic anhydride hardener', 'Anhydride curing-agent substance; isomer-specific commercial grades remain separate.'),
  ('40000000-0000-4000-8000-000000000025', null, 'Tetrahydrophthalic anhydride', 'THPA', '85-43-8', 'C8H8O3', 'C1C=CCC2C1C(=O)OC2=O', 'Cyclic anhydride hardener', 'Anhydride curing-agent substance; isomer-specific commercial grades remain separate.'),
  ('40000000-0000-4000-8000-000000000026', null, 'Pentaerythritol tetrakis(3-mercaptopropionate)', 'PETMP', '7575-23-7', 'C17H28O8S4', 'C(CS)C(=O)OCC(COC(=O)CCS)(COC(=O)CCS)COC(=O)CCS', 'Multifunctional thiol hardener', 'Four-functional mercaptopropionate curing-agent substance.'),
  ('40000000-0000-4000-8000-000000000027', null, 'Trimethylolpropane tris(3-mercaptopropionate)', 'TMPMP', '33007-83-9', 'C15H26O6S3', 'CCC(COC(=O)CCS)(COC(=O)CCS)COC(=O)CCS', 'Multifunctional thiol hardener', 'Three-functional mercaptopropionate curing-agent substance.'),
  ('40000000-0000-4000-8000-000000000028', null, '2,4,6-Tris((dimethylamino)methyl)phenol', 'DMP-30', '90-72-2', 'C15H27N3O', 'CN(C)CC1=CC(=C(C(=C1)CN(C)C)O)CN(C)C', 'Tertiary amine accelerator', 'Epoxy activator and homopolymerization catalyst substance.'),
  ('40000000-0000-4000-8000-000000000029', null, 'Boron trifluoride monoethylamine complex', 'BF3-MEA', '75-23-0', 'C2H7BF3N', 'B(F)(F)F.CCN', 'Latent Lewis acid catalyst', 'Latent epoxy catalyst complex; keep commercial grades separate.')
on conflict (id) do update set
  canonical_name = excluded.canonical_name,
  abbreviation = excluded.abbreviation,
  cas_number = excluded.cas_number,
  molecular_formula = excluded.molecular_formula,
  smiles = excluded.smiles,
  chemical_class = excluded.chemical_class,
  notes = excluded.notes;

insert into public.chemical_synonyms (chemical_id, synonym)
select chemical_id, synonym
from (values
  ('40000000-0000-4000-8000-000000000003'::uuid, 'Bis[4-(glycidyloxy)phenyl]methane'),
  ('40000000-0000-4000-8000-000000000003'::uuid, 'Diglycidyl ether of bisphenol F'),
  ('40000000-0000-4000-8000-000000000003'::uuid, 'Bisphenol F epoxy resin'),
  ('40000000-0000-4000-8000-000000000008'::uuid, '1,3,5-Triglycidyl isocyanurate'),
  ('40000000-0000-4000-8000-000000000008'::uuid, '1,3,5-Tris(oxiran-2-ylmethyl)-1,3,5-triazinane-2,4,6-trione'),
  ('40000000-0000-4000-8000-000000000009'::uuid, 'TGMDA'),
  ('40000000-0000-4000-8000-000000000009'::uuid, 'Tetraglycidyl methylenedianiline'),
  ('40000000-0000-4000-8000-000000000009'::uuid, 'N,N,N'',N''-Tetraglycidyl-4,4''-methylenedianiline'),
  ('40000000-0000-4000-8000-000000000010'::uuid, 'Cycloaliphatic diepoxide 2386-87-0'),
  ('40000000-0000-4000-8000-000000000010'::uuid, '7-Oxabicyclo[4.1.0]heptan-3-ylmethyl 7-oxabicyclo[4.1.0]heptane-3-carboxylate'),
  ('40000000-0000-4000-8000-000000000011'::uuid, 'Butanediol diglycidyl ether'),
  ('40000000-0000-4000-8000-000000000011'::uuid, '1,4-Bis(2,3-epoxypropoxy)butane'),
  ('40000000-0000-4000-8000-000000000012'::uuid, 'Hexanediol diglycidyl ether'),
  ('40000000-0000-4000-8000-000000000012'::uuid, '1,6-Bis(2,3-epoxypropoxy)hexane'),
  ('40000000-0000-4000-8000-000000000013'::uuid, 'NPG diglycidyl ether'),
  ('40000000-0000-4000-8000-000000000013'::uuid, '2,2-Dimethyl-1,3-propanediol diglycidyl ether'),
  ('40000000-0000-4000-8000-000000000014'::uuid, 'Glycidyl phenyl ether'),
  ('40000000-0000-4000-8000-000000000014'::uuid, '2-(Phenoxymethyl)oxirane'),
  ('40000000-0000-4000-8000-000000000015'::uuid, '1,2-Ethanediamine'),
  ('40000000-0000-4000-8000-000000000015'::uuid, 'Ethane-1,2-diamine'),
  ('40000000-0000-4000-8000-000000000016'::uuid, 'Aminoethylpiperazine'),
  ('40000000-0000-4000-8000-000000000016'::uuid, '1-(2-Aminoethyl)piperazine'),
  ('40000000-0000-4000-8000-000000000016'::uuid, '2-Piperazin-1-ylethanamine'),
  ('40000000-0000-4000-8000-000000000017'::uuid, 'H12MDA'),
  ('40000000-0000-4000-8000-000000000017'::uuid, '4,4''-Methylenebis(cyclohexylamine)'),
  ('40000000-0000-4000-8000-000000000017'::uuid, 'Diaminodicyclohexylmethane'),
  ('40000000-0000-4000-8000-000000000018'::uuid, 'm-Xylylenediamine'),
  ('40000000-0000-4000-8000-000000000018'::uuid, 'Meta-xylylenediamine'),
  ('40000000-0000-4000-8000-000000000018'::uuid, '1,3-Bis(aminomethyl)benzene'),
  ('40000000-0000-4000-8000-000000000019'::uuid, '4,4''-DDS'),
  ('40000000-0000-4000-8000-000000000019'::uuid, 'Diaminodiphenyl sulfone'),
  ('40000000-0000-4000-8000-000000000019'::uuid, '4,4''-Sulfonyldianiline'),
  ('40000000-0000-4000-8000-000000000020'::uuid, '4,4''-MDA'),
  ('40000000-0000-4000-8000-000000000020'::uuid, 'Diaminodiphenylmethane'),
  ('40000000-0000-4000-8000-000000000020'::uuid, '4,4''-Diaminodiphenylmethane'),
  ('40000000-0000-4000-8000-000000000021'::uuid, 'Cyanoguanidine'),
  ('40000000-0000-4000-8000-000000000021'::uuid, 'Dicyanodiamide'),
  ('40000000-0000-4000-8000-000000000021'::uuid, '2-Cyanoguanidine'),
  ('40000000-0000-4000-8000-000000000022'::uuid, '2-Methyl-1H-imidazole'),
  ('40000000-0000-4000-8000-000000000022'::uuid, '1H-Imidazole, 2-methyl-'),
  ('40000000-0000-4000-8000-000000000023'::uuid, '2E4MZ'),
  ('40000000-0000-4000-8000-000000000023'::uuid, '2-Ethyl-5-methyl-1H-imidazole'),
  ('40000000-0000-4000-8000-000000000024'::uuid, 'Hexahydro-1,3-isobenzofurandione'),
  ('40000000-0000-4000-8000-000000000024'::uuid, '3a,4,5,6,7,7a-Hexahydro-2-benzofuran-1,3-dione'),
  ('40000000-0000-4000-8000-000000000025'::uuid, '1,2,3,6-Tetrahydrophthalic anhydride'),
  ('40000000-0000-4000-8000-000000000025'::uuid, '3a,4,7,7a-Tetrahydro-2-benzofuran-1,3-dione'),
  ('40000000-0000-4000-8000-000000000026'::uuid, 'Pentaerythritol tetra(3-mercaptopropionate)'),
  ('40000000-0000-4000-8000-000000000026'::uuid, 'Pentaerythritol tetrakis(3-mercaptopropanoate)'),
  ('40000000-0000-4000-8000-000000000027'::uuid, 'Trimethylolpropane tris(3-mercaptopropanoate)'),
  ('40000000-0000-4000-8000-000000000027'::uuid, 'TMP tris(3-mercaptopropionate)'),
  ('40000000-0000-4000-8000-000000000028'::uuid, 'Tris(dimethylaminomethyl)phenol'),
  ('40000000-0000-4000-8000-000000000028'::uuid, '2,4,6-Tris[(dimethylamino)methyl]phenol'),
  ('40000000-0000-4000-8000-000000000028'::uuid, 'DMP30'),
  ('40000000-0000-4000-8000-000000000029'::uuid, 'Boron trifluoride ethylamine complex'),
  ('40000000-0000-4000-8000-000000000029'::uuid, 'Boron trifluoride monoethylamine'),
  ('40000000-0000-4000-8000-000000000029'::uuid, 'BF3 ethylamine')
) as curated(chemical_id, synonym)
on conflict do nothing;

insert into public.commercial_products (
  id, owner_user_id, trade_name, manufacturer, description, product_type, notes
) values
  ('60000000-0000-4000-8000-000000000100', null, 'VESTAMIN PACM', 'Evonik', 'Commercial PACM grade identified by Evonik as 4,4''-diaminodicyclohexylmethane for epoxy curing.', 'PURE_SUBSTANCE', 'Manufacturer reports at least 99.0 wt.% total two-ring amines; stereoisomer distribution varies.'),
  ('60000000-0000-4000-8000-000000000101', null, 'ANCAMINE K54', 'Evonik', 'Commercial epoxy activator and homopolymerization catalyst based on tris(dimethylaminomethyl)phenol.', 'UNKNOWN', 'Manufacturer reports at least 96.0% assay; retain as a commercial grade, not a synonym.'),
  ('60000000-0000-4000-8000-000000000102', null, 'JEFFAMINE D-230', 'Huntsman', 'Polyether amine curing-agent product used in coatings, adhesives, sealants, and composites.', 'MIXTURE', 'Average molecular weight is approximately 230; do not model this product as one pure small molecule.')
on conflict (id) do update set
  trade_name = excluded.trade_name,
  manufacturer = excluded.manufacturer,
  description = excluded.description,
  product_type = excluded.product_type,
  notes = excluded.notes;

insert into public.commercial_product_chemicals (
  commercial_product_id, chemical_id, concentration_min, concentration_max, concentration_unit
) values
  ('60000000-0000-4000-8000-000000000100', '40000000-0000-4000-8000-000000000017', 99.0, null, '% w/w'),
  ('60000000-0000-4000-8000-000000000101', '40000000-0000-4000-8000-000000000028', 96.0, null, '% assay')
on conflict (commercial_product_id, chemical_id) do update set
  concentration_min = excluded.concentration_min,
  concentration_max = excluded.concentration_max,
  concentration_unit = excluded.concentration_unit;
