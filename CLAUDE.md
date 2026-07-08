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

## Project facts

- Based on the marketplace starter kit; only the **fullscreen** extension
  point is used, served from the root route (`src/app/page.tsx`).
- All sibling folders under `C:\Marketplace` are reference material only —
  never modify them.
- Credentials (Edge admin Client ID/Secret) are stored in the Sitecore
  content tree at `/sitecore/system/Modules/ExperienceEdgeConsole/Settings`,
  JSON in the `Value` field (same pattern as publishing-center).
- Browser → own Next.js `/api/edge/*` routes → OAuth token
  (`auth.sitecorecloud.io`, client_credentials, audience
  `https://api.sitecorecloud.io`) → Admin API
  (`edge.sitecorecloud.io/api/admin/v1`). Tokens are cached server-side only.
- UI: Tailwind CSS v4 + Radix UI + CVA (Blok design language, NOT shadcn).
  UI primitives copied from the publishing-center/dictionary reference apps.
