# Google Play release handoff

Store display name: **Patentory**. The Expo slug and Android application ID below are stable technical identifiers and intentionally retain their original values.

## Build identity

- Expo project: `@cernsvr/patent-knowledge`
- Android application ID: `com.cerensivri.patentknowledge`
- Version: `1.0.0`; production version codes auto-increment in EAS
- Output: Android App Bundle (`.aab`)
- Signing: remote EAS Android keystore; enroll the resulting app in Play App Signing
- Expo SDK 57 targets Android API 36

## Before Play Console submission

1. Host the Next.js web application on its final HTTPS domain.
2. Set `NEXT_PUBLIC_SITE_URL` to that domain and add its callback URLs to the dedicated Patentory Supabase Auth redirect allow-list.
3. Add the legal developer/entity name and support email to `/privacy`.
4. Set EAS production variable `EXPO_PUBLIC_PRIVACY_URL=https://<domain>/privacy`, then create the final AAB.
5. Configure production SMTP in Supabase Auth; test confirmation and recovery links on web and Android.
6. Add Play Console store title, short/full descriptions, icon, phone screenshots, feature graphic, category, support email, and privacy-policy URL.
7. Complete content rating, target audience, ads declaration, app access instructions, and Data Safety.
8. Upload to Internal testing first; test installation, sign-up, password recovery, PDF upload/view, AI failure handling, account deletion, and two-account RLS isolation.

## Data Safety working notes

Validate these answers against the final production configuration rather than copying them blindly:

- Account data: e-mail address and optional display name, used for account management/app functionality.
- User content: uploaded patent PDFs, notes, tags, metadata, classifications, and optional AI analysis results.
- Files are stored privately in Supabase; data is encrypted in transit.
- AI processing is user-initiated. The selected patent PDF is sent to OpenAI as a service provider through a short-lived signed URL with response storage disabled.
- Data is not used for advertising or sold by the application.
- In-app deletion exists under **Hesap ve güvenlik** and removes Auth, database, AI-analysis, and private PDF data.
- Google also requires an external account-deletion web link. Add a prominently discoverable deletion-request route to the hosted site or document that signed-in users can delete immediately from the web settings page.

## External blockers

- OpenAI API billing/quota must be active for live AI output.
- A final web domain, developer/entity name, and public support e-mail are required for the privacy policy and Play listing.
- Play Console declarations and production rollout remain account-owner actions.
