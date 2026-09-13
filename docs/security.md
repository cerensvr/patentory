# Security model and release checklist

## Trust boundaries

- Web and Android clients are untrusted. They receive only the project URL and publishable key.
- PostgreSQL grants decide which objects are reachable through the Data API; RLS decides which rows the signed-in user may access.
- Supabase secret/service-role keys and Gemini/OpenAI credentials exist only in Edge Function secrets.
- PDF files are private objects. The database stores an object path, never a public URL.

## Required invariants

1. Every patent has a non-null `owner_user_id` referencing `auth.users`.
2. A user cannot select, insert for, update, or delete another user's patent.
3. Patent-child policies derive access from the parent patent instead of trusting a duplicated client-supplied owner field.
4. Storage object paths begin with the authenticated user's UUID and a patent UUID owned by that user.
5. Shared reference rows are read-only to ordinary users; a user may only mutate catalog rows carrying their own UUID.
6. UPDATE policies include both `using` and `with check`.
7. Privileged functions are not placed in the exposed schema. Exposed search functions are security invoker and execute-granted only to `authenticated`.
8. AI output is stored as suggestions and never overwrites user-confirmed data automatically.
9. AI suggestion tables are read-only to clients; review mutations run in a JWT-verified Edge Function that checks the duplicated owner field against the authenticated user.
10. API-provider requests originate only in the Edge Function, use strict structured output, and include explicit prompt-injection resistance.
11. The ChatGPT Plus bridge binds only to `127.0.0.1`, accepts browser requests only from the production Patentory origin or localhost, and accepts only short-lived signed URLs for the private `patent-pdfs` bucket.
12. The bridge validates the PDF signature and 50 MB limit, uses an isolated persistent Chrome profile, deletes each temporary PDF after the run, and never sends ChatGPT cookies or credentials to Supabase or Vercel.
13. Browser-imported analysis is scoped to an authenticated user's open run and is sanitized by the same server-side pipeline as API output before suggestions are written.

## Before a production release

- Run migration reset, pgTAP RLS tests, database lint, and Supabase security/performance advisors.
- Verify email confirmation, a production SMTP provider, redirect allow-lists, CAPTCHA, and rate limits.
- Confirm no `.env`, service-role key, AI provider key, signing file, or Google service credential is committed or bundled.
- Test two real accounts against guessed patent IDs and guessed Storage paths.
- Set Storage file-size/MIME limits and validate PDF magic bytes before analysis.
- Confirm Android's permanent application ID and remote Play signing key, host the privacy policy, and complete the Data Safety disclosure.
- Use short-lived signed PDF URLs and avoid logging signed URLs.
- Verify the local bridge CORS allow-list, loopback binding, temporary-file cleanup, and dedicated ChatGPT profile before distribution.
- Keep Auth JWT expiry short enough for the product's risk profile and revoke sessions before deleting users.
