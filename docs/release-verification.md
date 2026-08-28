# Patentory release verification

Verification date: 28 August 2026 (Europe/Istanbul)

## Automated checks

- Workspace TypeScript: passed for shared Supabase types, Next.js web, and Expo Android.
- Workspace lint: passed for web and mobile.
- Next.js production build: passed locally and on Vercel; 12 routes generated or server-rendered as expected.
- Expo Android production export: passed; Hermes bundle and 27 assets generated.
- Expo Doctor: 21/21 checks passed.
- Expo dependency compatibility check: passed.
- PostgreSQL pgTAP suite: 17/17 passed, including cross-user RLS and Storage isolation.
- PostgreSQL schema lint: no warnings or errors.
- Local Edge Function E2E: free bibliographic lookup for US3684617A, transient-provider retry, strict structured analysis, duplicate/weak-evidence suppression, cross-user denial, human acceptance, and account deletion passed.

## Live Supabase verification

- Dedicated project ref: `xuabyqeqheebplinbwmq` (technical project name: Patent Knowledge).
- Seven local PostgreSQL migrations match the seven remote migrations.
- `analyze-patent`, `lookup-patent-metadata`, `review-ai-suggestion`, and `delete-account` are active and require JWT authentication.
- A temporary second user could not read the demo patent or obtain a signed URL for its PDF; the user was deleted after the test.
- Supabase performance advisors report no unindexed foreign keys. The remaining performance notices are expected unused-index telemetry for this new, low-traffic project.
- The only security-advisor warning is leaked-password protection, which Supabase documents as Pro-only; it remains off to preserve the requested free plan. Eight-character alphanumeric minimums and refresh-token rotation are enabled.
- Supabase Auth Site URL is `https://patentory.vercel.app`; exact web, localhost, and Android password-recovery redirects are allow-listed.
- The unrelated Ata Yumurta Supabase project was not used or modified.

## Production web verification

- Canonical URL: [https://patentory.vercel.app](https://patentory.vercel.app)
- `/login`, `/privacy`, and `/delete-account` return HTTP 200; `/` redirects unauthenticated users to `/login`.
- Vercel production build and clean-domain alias passed.
- HTTPS includes HSTS, Content Security Policy, frame denial, MIME-sniffing protection, strict referrer policy, and a restrictive browser permissions policy.
- Vercel stores only the Supabase URL, publishable key, and canonical site URL as public client configuration. No service-role or OpenAI key is present.

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

- EAS build ID: `86a8dcbf-aaa0-4264-8b80-8a49a7eef345`
- Version: `1.0.0`; Android version code: `7`
- Distribution: Google Play Store Android App Bundle (`.aab`)
- Status: finished and downloaded as `releases/Patentory-1.0.0-build7.aab`.
- EAS artifact: [download the signed AAB](https://expo.dev/artifacts/eas/AIey8Qf9Ow7pDqiDFCDkN2SqzsXD610YJx-idqRf2ew.aab).
- Size: 68,289,809 bytes.
- SHA-256: `21a767eb6b5b432cd620144c26472085ea4510d431983203c038aef330c88210`.
- Archive integrity, Android signing, and Bundletool 1.18.3 validation passed. The signing certificate is the expected self-signed Android upload key.
- Hermes bytecode inspection confirms the production bundle contains `https://patentory.vercel.app/privacy`.

## External release inputs still required

- Legal developer/entity name and a monitored support e-mail for the privacy policy and Play listing.
- Production SMTP configuration and final e-mail-link tests.
- Play Console listing content, Data Safety/content-rating declarations, screenshots, and staged rollout approval.
- OpenAI API billing only if optional AI analysis should be enabled; ChatGPT Plus does not include API quota.
