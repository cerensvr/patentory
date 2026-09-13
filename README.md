# Patentory

Supabase-first patent knowledge manager for chemistry and materials R&D. Patentory uses the same private patent library in its Next.js web app and Expo Android app. The manual workflow works without AI.

Live web application: [patentory.vercel.app](https://patentory.vercel.app)

## Implemented MVP foundation

- Email/password authentication with Supabase Auth
- User-owned patent CRUD protected by PostgreSQL RLS
- Private PDF bucket with authenticated access and 15-minute signed URLs
- Manual metadata, application category, technical purpose, chemical/role, and custom-tag entry
- Canonical chemicals, separate synonyms, separate commercial products, and product-to-chemical mappings
- Free patent-number lookup with evidence-based category, purpose, chemical, role, and trade-product preselection; every suggestion remains editable
- Curated PubChem name variants for concept matching without treating trade names or registry identifiers as canonical chemical synonyms
- A 29-record epoxy catalog grouped into resins/reactive diluents, amine, latent, anhydride, and thiol curing systems
- Search RPC for patents and chemical concepts, including IPDA/synonym/trade-product resolution
- Responsive dark web UI and Android UI using graphite, steel blue, and limited warm accents
- Google Play-ready Android package ID and EAS production AAB profile
- Evidence-linked AI PDF analysis through JWT-protected Edge Functions
- Turkish AI reports with example-summary, formulation, manufacturing-step, test-result, and performance tables
- Evidence review queue for chemicals, commercial products, categories, and purposes
- Password recovery, in-app account deletion, and a public-ready privacy page
- SQL migrations, seed data, database linting, and pgTAP cross-user isolation tests

## Repository

```text
apps/web                 Next.js App Router application
apps/mobile              Expo Router Android application
apps/chatgpt-bridge      Local ChatGPT Plus browser bridge
packages/supabase        Generated shared database types
supabase/migrations      Versioned schema, grants, RLS, Storage, search and seeds
supabase/tests/database  pgTAP security tests
docs                     Architecture and security decisions
```

## Local setup

Requirements: Node.js 22+, pnpm 11+, Docker, and Supabase CLI.

```bash
pnpm install
npx supabase start
npx supabase db reset --local
```

Copy `.env.example` values into `apps/web/.env.local` and `apps/mobile/.env.local`. Only the Supabase project URL and publishable key belong in client environment files. Never add a service-role or AI provider key.

AI secrets are configured only in Supabase:

```bash
npx supabase secrets set OPENAI_API_KEY=... OPENAI_PATENT_MODEL=gpt-5.6
```

Run the clients:

```bash
pnpm bridge:install
pnpm dev:web
pnpm dev:mobile
```

`bridge:install` installs a per-user macOS LaunchAgent, so the local bridge starts automatically at login and restarts if needed. On the first Plus scan, sign in once in the dedicated Chrome window. Patentory handles later PDF uploads, prompts, result parsing, and database writes from its single scan button.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm build:web
npx supabase test db --local
npx supabase db lint --local --schema public --level warning --fail-on error
```

## Android release

The permanent candidate package ID is `com.cerensivri.patentknowledge`. Confirm it before the first Play Console upload because it cannot be changed for an existing listing.

```bash
cd apps/mobile
npx eas-cli init
npx eas-cli build --platform android --profile production
```

The production profile creates an Android App Bundle (`.aab`) with remote auto-incremented version codes. The EAS project, remote Play signing keystore, account-deletion flow, custom graphite/steel-blue launcher artwork, and `EXPO_PUBLIC_PRIVACY_URL=https://patentory.vercel.app/privacy` are configured. Before Play Console submission, complete the legal/support contact details, store listing, Data Safety answers, production SMTP, and tester track.

## Supabase project

Patentory uses the dedicated Supabase project currently named **Patent Knowledge** (`xuabyqeqheebplinbwmq`). It does not use or modify the unrelated **Ata Yumurta** project.

## AI analysis

`analyze-patent` prepares a short-lived, authenticated analysis job. The local loopback bridge downloads the private PDF, opens a dedicated persistent Chrome profile, submits the document to the signed-in user's ChatGPT Plus session, parses the JSON response, and returns it to the secured Edge Function for validation and persistence. Gemini remains available only as an explicit API fallback. The analysis extracts technical problem/solution, novelty, independent claims, chemicals, trade products, process steps, separate patent examples, per-example formulation rows, ordered manufacturing steps, test results, and performance measurements with page evidence. It writes a faithful Turkish abstract translation to a field that stays separate from the original abstract. `review-ai-suggestion` applies individually confirmed findings and records per-user accepted/rejected/corrected learning without mutating the curated chemistry catalog. `delete-account` removes private Storage objects before deleting the Auth user.

The upload, classification, CRUD, and filter workflow remains independent of provider availability. `pgvector` can be introduced later for semantic similarity without redesigning the relational core.
