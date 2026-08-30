# Patentory web release verification

Verification date: 30 August 2026 (Europe/Istanbul)

## Release scope

- Current release target is web only: [https://patentory.vercel.app](https://patentory.vercel.app).
- Android/Play Store publishing is excluded from this release. Existing mobile source is retained but is not a release artifact and was not submitted to a store.
- The unrelated Ata Yumurta / yumurta cari project was not used or modified.

## Automated checks

- Workspace TypeScript: passed.
- Workspace lint: passed.
- Next.js production build: passed locally and on Vercel; 12 routes generated or server-rendered as expected.
- PostgreSQL pgTAP suite: 30/30 passed, including catalog boundaries, synonym/product mappings, learning-memory isolation, cross-user RLS, and private Storage isolation.
- PostgreSQL schema lint: no warnings or errors.
- Edge Function E2E: passed. Coverage includes real-patent metadata lookup, PubChem synonym matching, separate commercial-product matching, Gemini 3.7 failure with Flash-Lite takeover, strict structured output, Turkish fields, example/formulation/production/test tables, weak-evidence suppression, cross-user denial, accepted/corrected learning reuse, and account deletion.

## Live Supabase verification

- Dedicated project ref: `xuabyqeqheebplinbwmq` (Patent Knowledge).
- Eleven local PostgreSQL migrations match the eleven remote migrations.
- `analyze-patent`, `lookup-patent-metadata`, `review-ai-suggestion`, and `delete-account` are deployed and require authenticated access.
- `GEMINI_API_KEY` is stored only as an encrypted Supabase Edge Function secret. It is not present in the web client, repository, or Vercel public environment.
- Gemini model order is `gemini-3.7-flash,gemini-3.5-flash-lite`; high-demand/quota-compatible errors automatically move to Flash-Lite.
- A temporary second user could not read the demo patent or obtain a signed PDF URL; the test account was deleted afterward.
- Curated catalog records remain separate from per-user AI learning memory. Rejecting or correcting a suggestion never mutates the shared chemical catalog.
- Commercial/trade products remain separate records with explicit chemical mappings and product type. Unknown grades are not assumed to be pure chemicals.
- The shared catalog contains 29 chemicals across epoxy resin/reactive diluent, amine hardener, latent hardener/accelerator, anhydride, thiol, and other-material families.

## Live patent analysis

- Test patent: `US3684617A`, using its private uploaded PDF.
- Gemini 3.7 returned a temporary high-demand response; the deployed fallback correctly continued with `gemini-3.5-flash-lite`.
- Final live result: 7 examples, 16 formulation rows, 19 ordered production steps, and 6 test-result rows.
- The abstract, example summaries, conditions, outcomes, production instructions, and test descriptions were returned in technical Turkish. Chemical/trade names, standard codes, quantities, and units remained unchanged.
- The final review contained 22 evidence-backed suggestions, including canonical chemical candidates and separately identified trade products such as `D.E.R. 331`.
- No suggestion was written to the library during verification. The `Yanlış / düzelt` flow opened the “Bu ifade neyi anlatıyor?” question and was closed without saving.

## Production web verification

- Canonical URL: [https://patentory.vercel.app](https://patentory.vercel.app)
- Vercel production deployment: `dpl_D7jFMFL7NkGEzQcqJhu6XtP1bWnK`; status `READY`; canonical alias applied.
- The authenticated live UI shows the Patentory logo, readable dark theme, explicit `Çıkış yap` control, Gemini model status, and no “Human-reviewed AI” or “AI optional” cards.
- `/login`, `/privacy`, and `/delete-account` are public; authenticated library, patent detail, catalog, settings, and private signed-PDF access work on the shared Supabase backend.
- HTTPS security headers include HSTS, Content Security Policy, frame denial, MIME-sniffing protection, strict referrer policy, and a restrictive browser permissions policy.
- Vercel contains only public Supabase client configuration and the canonical site URL. Service-role and AI keys remain server-side.

## Remaining account-level action

- The web production deployment is live. Enabling automatic deployment on every GitHub push still requires the repository owner to complete GitHub passkey/2FA confirmation for the Vercel GitHub App. Access selection is limited to `cerensvr/patentory`.
- Production SMTP and final e-mail-link delivery should be configured before inviting external users.
