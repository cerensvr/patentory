# Patentory release verification

Verification date: 28 August 2026 (Europe/Istanbul)

## Automated checks

- Workspace TypeScript: passed for shared Supabase types, Next.js web, and Expo Android.
- Workspace lint: passed for web and mobile.
- Next.js production build: passed; 12 routes generated or server-rendered as expected.
- Expo Android production export: passed; Hermes bundle and 27 assets generated.
- Expo Doctor: 21/21 checks passed.
- Expo dependency compatibility check: passed.
- PostgreSQL pgTAP suite: 17/17 passed, including cross-user RLS and Storage isolation.
- PostgreSQL schema lint: no warnings or errors.
- Local mocked Edge Function E2E: analysis, structured suggestions, cross-user denial, human acceptance, and account deletion passed.

## Live Supabase verification

- Dedicated project ref: `xuabyqeqheebplinbwmq` (technical project name: Patent Knowledge).
- Six local PostgreSQL migrations match the six remote migrations.
- `analyze-patent`, `review-ai-suggestion`, and `delete-account` are active and require JWT authentication.
- A temporary second user could not read the demo patent or obtain a signed URL for its PDF; the user was deleted after the test.
- The unrelated Ata Yumurta Supabase project was not used or modified.

## Real patent test

- Source: [US20210355267A1 on Google Patents](https://patents.google.com/patent/US20210355267A1/en)
- File: valid, unencrypted, seven-page PDF; 721,130 bytes.
- Upload: passed to the private `patent-pdfs` bucket under the authenticated demo user's path.
- Authenticated signed download: passed and returned a valid PDF of the same byte length.
- Manual classification: Coating; IPDA as Hardener; Chemical Resistance; High Adhesion; custom source tag.
- Search: `IPDA` concept/filter passed; `furfuryl` patent text search passed.
- Live OpenAI request: reached the secured Edge Function and failed gracefully because the API account has no active quota/billing. Manual workflows remained available.

## Device verification

- Native debug APK built successfully against compile/target API 36.
- Installed and launched on Android emulator `Medium_Phone`.
- SecureStore chunk-key compatibility issue found during runtime testing and fixed.
- Demo login passed; shared library, patent detail, private PDF action, AI failure state, and manual patent form were inspected.
- App display name and visible brand are Patentory; internal package ID remains `com.cerensivri.patentknowledge`.

## Production bundle

- EAS build ID: `ba585d6d-e002-4e01-be3e-efc14290a9ec`
- Version: `1.0.0`; Android version code: `6`
- Distribution: Google Play Store Android App Bundle (`.aab`)
- Status: finished and downloaded as `releases/Patentory-1.0.0-build6.aab`.
- Size: 68,289,900 bytes.
- SHA-256: `8d4e71a06732b727786f0e194ca95cb299761f724436c7ebb91db182850837b8`.
- Archive integrity, Android signing, and Bundletool validation passed. The signing certificate is the expected self-signed Android upload key.

## External release inputs still required

- A final public HTTPS web domain for the privacy and account-deletion pages.
- Legal developer/entity name and a monitored support e-mail for the privacy policy and Play listing.
- Production SMTP configuration and final e-mail-link tests.
- Play Console listing content, Data Safety/content-rating declarations, screenshots, and staged rollout approval.
- OpenAI API billing only if optional AI analysis should be enabled; ChatGPT Plus does not include API quota.
