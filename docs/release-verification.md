# Patentory release verification

Verification date: 30 August 2026 (Europe/Istanbul)

## Automated checks

- Workspace TypeScript: passed for shared Supabase types, Next.js web, and Expo Android.
- Workspace lint: passed for web and mobile.
- Next.js production build: passed locally and on Vercel; 12 routes generated or server-rendered as expected.
- Expo Android production export: passed; Hermes bundle and 27 assets generated.
- Expo Doctor: 20/21 checks passed. The only finding is Expo's newly recommended `expo@~57.0.18` / `expo-constants@~57.0.16` patch pair; installation is currently blocked upstream because the referenced `@expo/env@~2.4.3` package is not published. The verified app remains on `expo@57.0.17` / `expo-constants@57.0.15` and Android export passes.
- PostgreSQL pgTAP suite: 30/30 passed, including catalog boundaries, synonym/product mappings, learning-memory isolation, cross-user RLS, and Storage isolation.
- PostgreSQL schema lint: no warnings or errors.
- Local Edge Function E2E: free bibliographic lookup and evidence-based classification for three real patents, PubChem synonym matching, separate trade-product matching, Gemini 3.7 quota failure with Flash-Lite takeover, strict structured analysis, Turkish abstract persistence, original-abstract preservation, per-example formulation/manufacturing/test rows, duplicate/weak-evidence suppression, cross-user denial, accepted/corrected learning reuse, and account deletion passed.

## Live Supabase verification

- Dedicated project ref: `xuabyqeqheebplinbwmq` (technical project name: Patent Knowledge).
- Eleven local PostgreSQL migrations match the eleven remote migrations.
- `analyze-patent`, `lookup-patent-metadata`, `review-ai-suggestion`, and `delete-account` are active and require JWT authentication.
- A temporary second user could not read the demo patent or obtain a signed URL for its PDF; the user was deleted after the test.
- Supabase performance advisors report no unindexed foreign keys. The remaining performance notices are expected unused-index telemetry for this new, low-traffic project.
- The only security-advisor warning is leaked-password protection, which Supabase documents as Pro-only; it remains off to preserve the requested free plan. Eight-character alphanumeric minimums and refresh-token rotation are enabled.
- Curated, unambiguous PubChem name variants are stored as chemical synonyms. Registry identifiers and possible trade names are not collapsed into the synonym table.
- Commercial/trade products remain separate records with explicit chemical mappings and product type. Unknown grades are marked for verification rather than assumed to be pure chemicals.
- The shared catalog contains 29 chemicals: nine epoxy resin/reactive-diluent records, nine amine hardeners, five latent hardener/accelerator records, two anhydrides, two thiols, and two other formulation materials. Primary-source curation notes are in `docs/chemistry-catalog.md`.
- Supabase Auth Site URL is `https://patentory.vercel.app`; exact web, localhost, and Android password-recovery redirects are allow-listed.
- The unrelated Ata Yumurta Supabase project was not used or modified.

## Production web verification

- Canonical URL: [https://patentory.vercel.app](https://patentory.vercel.app)
- `/login`, `/privacy`, and `/delete-account` return HTTP 200; `/` redirects unauthenticated users to `/login`.
- Vercel production build `dpl_5tJSLrqK9jCNbKdSUSvSYN6YqT8R` and clean-domain alias passed.
- The authenticated live page showed all 29 chemical records in the expected families. DMP-30 appeared under latent hardeners/accelerators, and a live DMP-30 checkbox submission reached the filtered zero-result state correctly.
- HTTPS includes HSTS, Content Security Policy, frame denial, MIME-sniffing protection, strict referrer policy, and a restrictive browser permissions policy.
- Vercel stores only the Supabase URL, publishable key, and canonical site URL as public client configuration. No service-role or OpenAI key is present.

## Real patent test

- Source: [US20210355267A1 on Google Patents](https://patents.google.com/patent/US20210355267A1/en)
- File: valid, unencrypted, seven-page PDF; 721,130 bytes.
- Upload: passed to the private `patent-pdfs` bucket under the authenticated demo user's path.
- Authenticated signed download: passed and returned a valid PDF of the same byte length.
- Manual classification: Coating; IPDA as Hardener; Chemical Resistance; High Adhesion; custom source tag.
- Search: `IPDA` concept/filter passed; `furfuryl` patent text search passed.
- Evidence-based preselection: Coating and IPDA were detected for US20210355267A1; IPDA was assigned the Hardener role rather than inheriting a nearby epoxy-resin role.
- Trade-name test: the valid 11-page US6013755A PDF (1,517,979 bytes) detected `VESTAMIN IPD` as a separate commercial product, mapped it to IPDA, and assigned the Hardener role.
- Gemini is the primary PDF-analysis provider; 3.7 Flash and 3.5 Flash-Lite fallback behavior passed locally against the secured Edge Function contract.

## Device verification

- Native debug APK built successfully against compile/target API 36.
- Installed and launched on Android emulator `Medium_Phone`.
- SecureStore chunk-key compatibility issue found during runtime testing and fixed.
- Demo login passed; shared library, patent detail, private PDF action, AI failure state, and controlled patent form were inspected.
- The real `US20210355267A1.pdf` was selected in the emulator. Publication number, country, title, assignee, publication date, and original abstract were populated; Coating, IPDA, and the Hardener role were preselected while remaining editable.
- The real `US6013755A.pdf` was selected in the emulator. `VESTAMIN IPD` appeared under the separate commercial-product section with its IPDA mapping and Hardener role.
- The Turkish abstract field is separate from the original abstract. Successful AI analysis writes the faithful Turkish translation only to the Turkish field; without AI quota it remains manually editable.
- App display name and visible brand are Patentory; internal package ID remains `com.cerensivri.patentknowledge`.
- The updated Android interface loaded the 29-record chemical catalog and the separate commercial-product list while the demo account remained signed in on `Medium_Phone`.

## Production bundle

- EAS build ID: `00c21729-78e9-4494-8def-7202fce52f09`
- Version: `1.0.0`; Android version code: `11`
- Distribution: Google Play Store Android App Bundle (`.aab`)
- Status: finished and downloaded as `releases/Patentory-1.0.0-build11.aab`.
- EAS artifact: [download the signed AAB](https://expo.dev/artifacts/eas/ee0CbxEhzz8Rf4DWfIlZNN2iwz9tXaxqU3T7ODRKnFM.aab).
- Size: 68,300,303 bytes.
- SHA-256: `3bf6556d29e894f46967cce56122ffa4c14ff5a2b58f7ede71b516b4801907a6`.
- Archive integrity, Android signing, and Bundletool 1.18.3 validation passed. The signing certificate is the expected self-signed Android upload key.
- Bundle manifest verification passed for package `com.cerensivri.patentknowledge`, version code 11, minimum SDK 24, and target/compile SDK 36.
- Hermes bytecode inspection confirms the production bundle contains `https://patentory.vercel.app/privacy`.

## External release inputs still required

- Legal developer/entity name and a monitored support e-mail for the privacy policy and Play listing.
- Production SMTP configuration and final e-mail-link tests.
- Play Console listing content, Data Safety/content-rating declarations, screenshots, and staged rollout approval.
- A Gemini API key must be stored as a Supabase Edge Function secret before live Gemini analysis can run. ChatGPT Plus does not include API quota.
