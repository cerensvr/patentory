# Patentory — Supabase-first architecture

## Product boundary

The MVP is a shared patent library backend used by a Next.js web application and an Expo React Native Android application. Supabase provides PostgreSQL, Auth, private Storage, Data API, and Edge Functions. The manual patent workflow must remain fully usable when AI is unavailable.

AI extraction runs only in JWT-protected Edge Functions, writes reviewable suggestions instead of overwriting confirmed data, and stores versioned analysis runs. Manual workflows remain fully independent of AI availability.

## Repository structure

```text
apps/
  web/                 Next.js App Router web client
  mobile/              Expo Router Android client
packages/
  supabase/            Generated database types shared by both clients
supabase/
  config.toml          Local Supabase configuration
  migrations/          Ordered PostgreSQL schema and policy changes
  seed.sql             Shared chemical roles/categories/purposes
  tests/database/      pgTAP schema and RLS tests
  functions/           AI analysis, suggestion review, and account deletion
docs/
  architecture.md      This decision record
  security.md          Threat model and release checklist
```

## Database model

### Identity and patent ownership

- `profiles`: one row per `auth.users` user. The primary key is the Auth user UUID.
- `patents`: nullable patent metadata plus required `owner_user_id`, timestamps, favorite/archive flags, AI status, and a private Storage object path rather than a public URL.
- Every patent-owned relation carries a `patent_id`; its RLS policy verifies ownership through the parent patent. This protects data even if a client omits an owner filter.

### Classification and chemistry

- `application_categories` and `technical_purposes` support parent/child hierarchies. A null `owner_user_id` is curated shared data; a non-null value is private user-created data.
- `chemicals` stores canonical identity only. `chemical_synonyms` stores alternate spellings against one chemical.
- `commercial_products` stores trade products independently. A product can represent a pure substance, mixture, or formulated product.
- `commercial_product_chemicals` maps zero or more known chemicals to a trade product with optional concentration bounds and units. No mapping implies that composition is unknown.
- `chemical_roles` is curated shared reference data.
- `patent_chemicals` can point to a canonical chemical, a commercial product, or both. This preserves source wording while enabling searches through explicit product-to-chemical mappings.
- `patent_application_categories`, `patent_technical_purposes`, and `patent_tags` are normalized join tables.
- `tags` are always private to their creator.
- `ai_analysis_runs` stores versioned structured results, model/token metadata, failures, and review state for one user-owned patent.
- `ai_analysis_suggestions` stores evidence-linked chemical, trade-product, category, and purpose proposals. The client has read-only table access; an authenticated Edge Function applies decisions.

### Search semantics

The filter layer uses stable UUID identifiers, not display strings. Chemical filtering matches a patent when either:

1. `patent_chemicals.chemical_id` equals the selected canonical chemical; or
2. the patent references a commercial product that has an explicit row in `commercial_product_chemicals` for that chemical.

Name lookup searches canonical name, abbreviation, synonyms, and visible commercial product names. OR applies within application/purpose/country groups. Selected chemicals use AND semantics so a query for IPDA and PMHS requires both concepts. Cross-group filters use AND. A security-invoker PostgreSQL function provides one auditable filter contract and keyset pagination while RLS remains active.

## RLS and Data API strategy

- Every table in the exposed `public` schema has RLS enabled.
- No table is granted to `anon`; only authentication endpoints are usable before sign-in.
- `authenticated` receives only the table privileges needed by clients. PostgreSQL grants make Data API exposure explicit; RLS controls row access.
- Directly owned rows use `(select auth.uid()) = owner_user_id`.
- Patent child rows use an indexed `exists` lookup to a patent owned by `(select auth.uid())`.
- Shared catalog rows (`owner_user_id is null`) are readable but writable only by trusted server-side administration. Users can create and mutate only their own catalog rows.
- UPDATE policies always include both `using` and `with check`; ownership cannot be reassigned.
- All RLS predicates and foreign keys are indexed.
- No authorization decision uses user-editable `user_metadata`.
- Public functions have execution revoked by default. The search function is `security invoker` and granted only to `authenticated`.

## Private PDF Storage

Bucket: `patent-pdfs`, `public = false`, MIME type `application/pdf`, initial file-size limit 50 MiB.

Object path:

```text
{auth-user-id}/{patent-id}/{random-uuid}.pdf
```

Storage RLS checks that the first path segment equals `(select auth.uid())::text` and that the second segment identifies a patent owned by that user. The patent row is created before upload so this policy can verify ownership. Uploads do not use upsert, so identical original filenames cannot overwrite one another. The database stores the original filename separately.

Viewing uses authenticated downloads or short-lived signed URLs created under the user's JWT. A public URL is never stored. Patent deletion removes the object and row under the authenticated user's RLS context. Account deletion uses an authenticated Edge Function to remove every private object before deleting the Auth user and cascading relational records.

## AI analysis boundary

- `analyze-patent` verifies the caller with `auth.getUser()`, re-checks patent ownership, enforces PDF MIME/size and per-user run limits, then creates a three-minute signed URL for OpenAI.
- The OpenAI Responses API receives the PDF at high detail with strict JSON Schema output and `store: false`. The PDF is treated as untrusted data; document instructions cannot override the analysis prompt. A hashed user/patent identifier is used for provider-side abuse monitoring; no e-mail address is sent.
- Canonical chemical, synonym, and commercial-product matching remain separate. A trade name is never inferred to be a pure chemical without an explicit catalog mapping.
- Runtime validation trims and bounds every field, deduplicates findings, and excludes suggestions below the confidence/evidence floor from the actionable review queue. Claims, prior art, description, and experimental examples are explicitly separated in the prompt.
- Every actionable suggestion includes confidence and a short direct evidence quote. `review-ai-suggestion` re-verifies the user and applies only an explicit accept/reject decision; unmatched roles cannot silently fall back to “Other”.
- Transient provider failures are retried once within an overall deadline. Quota, configuration, timeout, and incomplete-response failures use safe user-facing error codes while the manual workflow stays available.
- `lookup-patent-metadata` is an authenticated, free metadata fallback. It recognizes a publication number from the selected PDF filename and retrieves bibliographic fields without sending the PDF to an AI provider.
- `OPENAI_API_KEY`, the service-role key, and signed URLs never enter client bundles or application logs.

## Authentication

- Supabase Auth email/password is the MVP identity provider.
- Web uses `@supabase/ssr`: browser and server clients are separated, and server-rendered protected routes verify claims rather than trusting cookie presence alone.
- Expo uses `@supabase/supabase-js` with encrypted persisted session storage backed by Expo SecureStore. Deep links support password recovery.
- Google Play release builds use a permanent Android application ID, EAS Build credentials, HTTPS-only traffic, and no embedded privileged secrets.

## Client architecture

### Web

Next.js App Router with strict TypeScript. Route groups separate public auth screens from authenticated application screens. Server Components load initial patent-library data; mutations use Supabase clients under the authenticated user's RLS context. TanStack Query is reserved for interaction-heavy screens, not required for simple server reads.

### Android

Expo Router with strict TypeScript. Feature folders contain auth, patent library, upload, filters, and patent detail screens. The app talks to the same Data API and Storage bucket as web. Android document picker uploads PDFs to the user/patent object path. EAS configuration is committed without credentials; signing material remains managed outside Git.

### Shared packages

Generated database types are the source of truth for both clients. UI components remain platform-specific so Android and web can follow their native interaction patterns.

## Environment variables

Client-safe values:

- Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Expo: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_PRIVACY_URL`

Server-only values:

- Edge Functions receive Supabase platform secrets automatically.
- `OPENAI_API_KEY` and `OPENAI_PATENT_MODEL` are configured through Supabase secrets, never through client-prefixed variables.
- Secret/service-role keys are forbidden in web bundles, Expo configuration, committed files, logs, and analytics.

## Implementation sequence

1. Initialize the monorepo and local Supabase project.
2. Add schema, constraints, indexes, explicit grants, RLS, private bucket, and seed data migrations.
3. Add pgTAP tests for cross-user isolation and Storage paths; run database lint/advisors.
4. Generate shared TypeScript database types.
5. Build web and Expo authentication.
6. Build patent create/read/update/delete and private PDF upload/view.
7. Add chemistry, trade-product, category, purpose, and custom-tag editing.
8. Add keyset-paginated patent library and combined filters.
9. Complete responsive/mobile QA and Play Store release configuration.
10. Add evidence-linked AI runs, human suggestion review, password recovery, privacy, and account deletion.
11. Run production web/Android builds, Supabase advisors, and an EAS Android App Bundle build.
