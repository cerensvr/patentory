# Patentory epoxy chemistry catalog

Verification date: 29 August 2026

## Modeling rules

- `chemicals` contains a canonical substance identity: one preferred name, abbreviation, CAS number, formula, SMILES, and chemical class.
- Alternate chemical names belong in `chemical_synonyms`; CAS numbers, supplier codes, and trade names are not synonyms.
- Supplier grades belong in `commercial_products`. A commercial product is mapped to a chemical only when the supplier identifies the underlying substance. Formulated/polymeric products may intentionally have no one-to-one chemical mapping.
- Patent search resolves canonical names, abbreviations, curated synonyms, and explicitly mapped commercial products without collapsing those source strings into one record.

## Filter families

The shared catalog currently contains 29 chemicals, shown in six practical filter families:

| Family | Included catalog entries |
| --- | --- |
| Epoxy resins and reactive diluents | DGEBA, DGEBF, TGIC, TGDDM/TGMDA, ECC, BDDGE, HDDGE, NPGDGE, PGE |
| Amine hardeners | IPDA, DETA, TETA, EDA, AEP, PACM/H12MDA, MXDA, DDS, MDA |
| Latent hardeners and accelerators | DICY, 2MI, 2E4MI/2E4MZ, DMP-30, BF3-MEA |
| Anhydride hardeners | HHPA, THPA |
| Thiol hardeners | PETMP, TMPMP |
| Other formulation materials | PMHS, sodium bicarbonate |

The first five families are presented separately in the web filter. Android shows the same records as multi-select chips with their chemical class. Selecting multiple chemicals uses AND semantics, so a DGEBA + IPDA selection returns patents containing both concepts.

## Commercial-grade boundary

- `VESTAMIN PACM` is stored separately from canonical PACM and explicitly mapped to it.
- `ANCAMINE K54` is stored separately from canonical DMP-30 and explicitly mapped with the supplier-reported minimum assay.
- `JEFFAMINE D-230` is a polyether-amine commercial product and is deliberately not represented as one pure small molecule.
- Existing IPDA, DGEBA, DETA, and TETA trade grades remain separate product records even when they can participate in concept search through an explicit mapping.

## Primary references

- [PubChem PUG REST](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest) was used to verify substance identifiers and retrieve candidate name variants. Only unambiguous chemical names were curated into the database.
- [PubChem: Dicyandiamide](https://pubchem.ncbi.nlm.nih.gov/compound/10005) supports DICY identity and its epoxy-curing context.
- [PubChem: 2-Methylimidazole](https://pubchem.ncbi.nlm.nih.gov/compound/693-98-1) supports 2MI identity and epoxy-resin use.
- [Evonik VESTAMIN curing agents](https://products.evonik.com/assets/43/58/VESTAMIN_Curing_agents_for_epoxy_resin_systems_global_EN_Asset_794358.pdf) identifies IPD and PACM grades as epoxy curing agents.
- [Evonik VESTAMIN PACM technical data](https://products.evonik.com/assets/n_/us/VESTAMIN_EP_1812_TDS_EN_EN_TDS_PV_52047206_en_US.pdf) supports the PACM commercial-grade mapping and reported two-ring amine content.
- [Evonik ANCAMINE K54 technical data](https://products.evonik.com/assets/em/ea/Ancamine_K54_EMEA_TDS_EN_EN_TDS_PV_52041301_en_GB_EMEA.pdf) supports its role as an epoxy activator/homopolymerization catalyst and the supplier-reported assay.
- [Huntsman JEFFAMINE D-230](https://products.huntsman.com/products/jeffamine-d230) supports modeling D-230 as a polyether-amine curing-agent product with an average molecular weight rather than a single canonical molecule.

The catalog is a search/classification aid, not a safety database. Safety, regulatory, and formulation decisions must still use the current supplier SDS/TDS and applicable regulations.
