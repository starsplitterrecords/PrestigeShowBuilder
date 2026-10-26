# Production security

## Emergency credential-remediation checklist

The former `GET /api/config` implementation returned the values of
`GEMINI_API_KEY` and `API_KEY`. Previous Vite configuration also
inlined those variables into client-side JavaScript. Treat any credential
used in a publicly deployed affected build as potentially exposed.

1. Revoke/rotate any potentially exposed Gemini / Google AI Studio API key.
2. Redeploy from a commit including the corrected `server.ts` and
   `vite.config.ts`; old deployments are not fixed by a GitHub commit.
3. Purge any previously published static build or CDN artifacts that may
   contain inlined keys. Assume old artifacts may have been copied.
4. Inspect Google API usage, quota, and billing for unexpected activity.
5. Test `/api/config` and confirm it reports booleans, never secret values.

## Gemini proxy

`/gemini-api-proxy/*` **fails closed** unless BOTH of these
server-side values are set:

- `GEMINI_API_KEY` (or `API_KEY`): a valid Google Gemini API credential.
- `GEMINI_PROXY_ACCESS_TOKEN`: a random secret of at least 32 characters.

All proxy requests must present
`Authorization: Bearer <GEMINI_PROXY_ACCESS_TOKEN>`.

**Do not embed the proxy access token in a public browser build**, static
HTML, frontend environment variables, or browser storage: a shared bearer
secret placed in a public client is not authentication. This built-in bearer
gate is designed only for trusted server-to-server callers. For an
end-user-facing deployed app, integrate a real user/session identity provider
and apply per-user quotas and rate limits before enabling browser access.
Until then, the protected proxy may be unavailable to public-browser users.

Server API keys must not be supplied from query parameters or echoed by
configuration endpoints.

## Smoke checks after deployment

- `GET /api/config` returns boolean properties, not secret strings.
- `POST /gemini-api-proxy/v1beta/models/...:generateContent` with no
  bearer authorization returns 401 if configured, or 503 if disabled.
- A bearer value that does not match is denied.
- No published JS bundle contains a server Gemini API key.
- Required authentication and service-key configuration is performed in
  the server's private environment only.

These measures prevent the previously identified exposure paths; a broader
security review should also address origin policy, deployment access
controls, rate limiting, audit logging, dependency maintenance, and
Firebase storage rules.
