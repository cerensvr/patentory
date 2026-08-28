# Google Play release handoff

Store display name: **Patentory**. The Expo slug and Android application ID below are stable technical identifiers and intentionally retain their original values.

## Build identity

- Expo project: `@cernsvr/patent-knowledge`
- Android application ID: `com.cerensivri.patentknowledge`
- Version: `1.0.0`; production version codes auto-increment in EAS
- Output: Android App Bundle (`.aab`)
- Signing: remote EAS Android keystore; enroll the resulting app in Play App Signing
- Expo SDK 57 targets Android API 36

## Completed release preparation

- The production web application is live at [patentory.vercel.app](https://patentory.vercel.app).
- The dedicated Supabase Auth Site URL and exact web/mobile password-recovery redirects are configured.
- EAS production uses `EXPO_PUBLIC_PRIVACY_URL=https://patentory.vercel.app/privacy`.
- The signed production Android App Bundle is built with an auto-incremented version code.

## Before Play Console submission

1. Add the legal developer/entity name and monitored support email to `/privacy`.
2. Configure production SMTP in Supabase Auth; test confirmation and recovery links on web and Android.
3. Add Play Console store title, short/full descriptions, icon, phone screenshots, feature graphic, category, support email, and privacy-policy URL.
4. Complete content rating, target audience, ads declaration, app access instructions, and Data Safety.
5. Upload to Internal testing first; test installation, sign-up, password recovery, PDF upload/view, AI failure handling, account deletion, and two-account RLS isolation.

## Data Safety working notes

Validate these answers against the final production configuration rather than copying them blindly:

- Account data: e-mail address and optional display name, used for account management/app functionality.
- User content: uploaded patent PDFs, notes, tags, metadata, classifications, and optional AI analysis results.
- Files are stored privately in Supabase; data is encrypted in transit.
- AI processing is user-initiated. The selected patent PDF is sent to OpenAI as a service provider through a short-lived signed URL with response storage disabled.
- Data is not used for advertising or sold by the application.
- In-app deletion exists under **Hesap ve güvenlik** and removes Auth, database, AI-analysis, and private PDF data.
- Google's external account-deletion link can use `https://patentory.vercel.app/delete-account`; signed-in users can also delete immediately from web or Android settings.

## External blockers

- OpenAI API billing/quota must be active for live AI output; all manual workflows remain available without it.
- The legal developer/entity name and public support e-mail are required for the privacy policy and Play listing.
- Play Console declarations and production rollout remain account-owner actions.
