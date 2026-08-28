# Patentory

Supabase-first patent knowledge manager for chemistry and materials R&D. Patentory uses the same private patent library in its Next.js web app and Expo Android app. The manual workflow works without AI.

Live web application: [patentory.vercel.app](https://patentory.vercel.app)

## Implemented MVP foundation

- Email/password authentication with Supabase Auth
- User-owned patent CRUD protected by PostgreSQL RLS
- Private PDF bucket with authenticated access and 15-minute signed URLs
- Manual metadata, application category, technical purpose, chemical/role, and custom-tag entry
- Canonical chemicals, separate synonyms, separate commercial products, and product-to-chemical mappings
- Search RPC for patents and chemical concepts, including IPDA/synonym/trade-product resolution
- Responsive dark web UI and Android UI using graphite, steel blue, and limited warm accents
- Google Play-ready Android package ID and EAS production AAB profile
- Evidence-linked AI PDF analysis through JWT-protected Edge Functions
- Human review queue for chemicals, commercial products, categories, and purposes
- Password recovery, in-app account deletion, and a public-ready privacy page
- SQL migrations, seed data, database linting, and pgTAP cross-user isolation tests

## Repository

```text
apps/web                 Next.js App Router application
apps/mobile              Expo Router Android application
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

Copy `.env.example` values into `apps/web/.env.local` and `apps/mobile/.env.local`. Only the Supabase project URL and publishable key belong in client environment files. Never add a service-role key or OpenAI key.

AI secrets are configured only in Supabase:

```bash
npx supabase secrets set OPENAI_API_KEY=... OPENAI_PATENT_MODEL=gpt-5.6
```

Run the clients:

```bash
pnpm dev:web
pnpm dev:mobile
```

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

`analyze-patent` sends a three-minute signed private PDF URL to the OpenAI Responses API with high-detail PDF input, Structured Outputs, `store: false`, prompt-injection instructions, a 50 MB limit, per-user rate limiting, and versioned analysis runs. It extracts technical problem/solution, novelty, independent claims, chemicals, trade products, process steps, examples, and performance measurements with page evidence. Suggestions never modify confirmed library data automatically; `review-ai-suggestion` verifies the user again and applies only individually accepted items. `delete-account` removes private Storage objects before deleting the Auth user.

The manual upload, classification, CRUD, and filter workflow remains independent of OpenAI availability. `pgvector` can be introduced later for semantic similarity without redesigning the relational core.
