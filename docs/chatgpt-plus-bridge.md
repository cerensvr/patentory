# Local ChatGPT Plus bridge

Patentory's primary web scan path uses the signed-in user's ChatGPT Plus session through a private service on the same Mac. It does not convert a Plus subscription into an API key and does not expose the ChatGPT session to the hosted web application.

## One-time setup

```bash
pnpm install
pnpm bridge:install
```

The installer creates `~/Library/LaunchAgents/com.patentory.chatgpt-bridge.plist`. macOS launches the service automatically at login and restarts it when necessary. The bridge creates an isolated browser profile under `~/.patentory/chatgpt-profile`; the first scan may require one ChatGPT login in that Chrome window.

## Request flow

1. The authenticated web app asks `analyze-patent` to create an open ChatGPT run.
2. The Edge Function returns a three-minute signed PDF URL and the server-built prompt.
3. The browser calls the loopback bridge at `http://127.0.0.1:47831`.
4. The bridge downloads and validates the PDF, uploads it in ChatGPT, waits for one JSON response, and deletes the temporary PDF.
5. The web app sends the parsed object to `complete_chatgpt`; the Edge Function verifies ownership, sanitizes the result, writes suggestions, and closes the run.

If the local service, login, or ChatGPT response fails, the web app records a safe failure code and leaves the patent ready to retry. Gemini is retained only as a user-selected fallback in the interface.

## Security boundaries

- The server binds only to loopback and has an exact production-origin allow-list plus localhost development origins.
- Only signed HTTPS Supabase Storage URLs for the `patent-pdfs` bucket are accepted.
- Downloads are capped at 50 MB and must begin with the PDF magic signature.
- Temporary files are removed after success or failure.
- The hosted site never receives the ChatGPT cookie or browser profile.
- Only a still-open run belonging to the authenticated patent owner can be completed.

Because this is browser automation rather than an official API integration, ChatGPT interface changes can require selector maintenance. The API fallback remains available for recovery.
