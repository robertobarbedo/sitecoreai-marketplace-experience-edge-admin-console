# Experience Edge Console — notes for Claude Code

## Do NOT run or test this app standalone

SitecoreAI Marketplace apps **cannot run as standalone web apps**. The
Marketplace SDK (`ClientSDK.init({ target: window.parent })`) requires the app
to be embedded in an iframe inside SitecoreAI — outside of it, initialization
hangs/fails and every page is non-functional. The `/api/edge/*` routes also
require real Edge administration credentials to return anything useful.

Therefore: **do not start the dev server, open the app in a browser, or
attempt runtime testing.** Verification is limited to:

- `npm run build` (type-check + lint + compile) must pass
- Manual testing happens only inside SitecoreAI after the app is registered
  in Developer Studio (fullscreen extension point → the root route `/`)

## Webhook run history

Experience Edge has **no history endpoint**. The execution log rides on the
webhook object itself: `lastRuns: [{ timestamp, success, message }]` plus
`disabled` (Edge auto-disables after 10 consecutive failures; a run that does
not answer within 30 s counts as failed). Order is undocumented, so
`src/utils/webhook-runs.ts` sorts newest-first defensively. The details dialog
re-GETs `/webhooks/{id}` on open because runs go stale while the list is held.
Docs: [webhook objects](https://doc.sitecore.com/sai/en/developers/sitecoreai/experience-edge/webhook-objects/webhook-objects.html).

Manual tests from this console call the endpoint directly and are **not**
recorded in `lastRuns`. They are SSRF-guarded: the test route calls the
endpoint through `publicHttpsRequest` (`src/lib/edge/public-https.ts`, a thin
wrapper over `safeRequest` in `src/utils/ssrfGuard.ts` — the shared guard,
kept byte-identical across apps) — https on 443 only, IP-literal hosts
refused, every resolved address must be public unicast per ipaddr.js
(allowlist; checked inside the socket's own DNS lookup, so no DNS-rebinding
gap), no redirects followed, 15 s timeout, response read capped. Never switch
it back to plain `fetch`.

## Project facts

- Based on the marketplace starter kit; only the **fullscreen** extension
  point is used, served from the root route (`src/app/page.tsx`).
- All sibling folders under `C:\Marketplace` are reference material only —
  never modify them.
- Credentials (Edge admin Client ID/Secret) are stored in the Sitecore
  content tree at
  `/sitecore/system/Modules/Marketplace/ExperienceEdgeAdminConsole/Settings`,
  JSON in the `Value` field (same pattern as publishing-center). Loads fall
  back to the legacy pre-Marketplace path (`LEGACY_SETTINGS_ITEM_PATH` in
  constants.ts); saves always write the new path and ensure both the
  Marketplace and module folders exist.
- The Client Secret is **sealed server-side** (AES-256-GCM, key from the
  required `EDGE_SECRET_ENCRYPTION_KEY` env var — see
  `src/lib/edge/secret-crypto.ts`). Only the ciphertext reaches the content
  tree, the browser, and the `x-edge-client-secret` header; the settings
  dialog never prefills or reveals it. Stored payload is `version: 2`
  (`secretCipher`). The seal format is `v3.` with the caller's verified
  **`org_id` token claim and the client ID as GCM AAD**, so a cipher only
  opens for a signed-in user of the same organization, next to the client
  ID it was sealed for; changing the Client ID requires re-entering the
  secret, and a token without `org_id` is refused (`organization_unknown`).
  `readCredentials` (request.ts, async — it re-verifies the token) accepts
  ONLY `v3.` ciphers; the validate route is the one place that takes
  plaintext (typed, or a `version: 1` plaintext item migrated on load) and
  returns a `v3.` cipher. Older `v1.`/`v2.` ciphers are rejected, never
  re-sealed (that would let a copied cipher be adopted by another org) —
  the user re-enters the secret. Upstream Edge/token error bodies are logged
  server-side only; `edgeErrorResponse` returns fixed per-status messages.
  The sealing code is shared with the webhooks sibling app
  (same HKDF salt/info and format), which reads this app's Settings item.
  Never add a plaintext fallback — missing key must fail the save.
- **API auth**: `src/middleware.ts` (Node.js runtime) runs
  `requireSitecoreUser` on every `/api/*` route; `useEdgeApi` calls them
  with `authedFetch`. `src/lib/marketplace-auth/` is a copy of the shared kit
  (master in content-publish-inspector) — keep it byte-identical. The page
  is wrapped in a non-blocking `MarketplaceAuthProvider` (`AuthBoundary` in
  page.tsx).
- Browser → own Next.js `/api/edge/*` routes → OAuth token
  (`auth.sitecorecloud.io`, client_credentials, audience
  `https://api.sitecorecloud.io`) → Admin API
  (`edge.sitecorecloud.io/api/admin/v1`). Tokens are cached server-side only.
- UI: Tailwind CSS v4 + Radix UI + CVA (Blok design language, NOT shadcn).
  UI primitives copied from the publishing-center/dictionary reference apps.
