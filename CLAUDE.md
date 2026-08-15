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
recorded in `lastRuns`.

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
  (`secretCipher`); `version: 1` plaintext items are migrated on load.
  Never add a plaintext fallback — missing key must fail the save.
- Browser → own Next.js `/api/edge/*` routes → OAuth token
  (`auth.sitecorecloud.io`, client_credentials, audience
  `https://api.sitecorecloud.io`) → Admin API
  (`edge.sitecorecloud.io/api/admin/v1`). Tokens are cached server-side only.
- UI: Tailwind CSS v4 + Radix UI + CVA (Blok design language, NOT shadcn).
  UI primitives copied from the publishing-center/dictionary reference apps.
