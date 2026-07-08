# Experience Edge Console

A Sitecore Marketplace app that provides a management console for the
[Experience Edge Admin REST API](https://doc.sitecore.com/sai/en/developers/sitecoreai/experience-edge/experience-edge-apis/admin-rest-api.html):

- **Webhooks** — list, create, edit, and delete Experience Edge webhooks
- **Cache** — clear the delivery cache or delete all published content
- **Settings** — view and update cache TTLs and auto-clear flags

Built on the [Sitecore Marketplace starter kit](https://github.com/Sitecore/marketplace-starter)
(Next.js 15 + React 19 + `@sitecore-marketplace-sdk`), using the
**fullscreen extension point** and the Blok design language (Tailwind CSS v4 +
Radix UI).

## How authentication works

Marketplace apps have **no default access** to the Experience Edge Admin API.
Users must supply the **Client ID** and **Client Secret** of an *Edge
administration client* created for the target environment (in SitecoreAI
Deploy / Cloud Portal).

- Credentials are entered in the app's settings dialog and persisted in the
  Sitecore content tree at
  `/sitecore/system/Modules/ExperienceEdgeConsole/Settings` (JSON in the
  `Value` field), via the Marketplace SDK's authoring GraphQL.
  > ⚠️ Anyone with authoring access to `/sitecore/system/Modules` can read the
  > stored secret. This is the same tradeoff accepted by sibling marketplace
  > modules that store settings in the content tree.
- The browser never calls `auth.sitecorecloud.io` or the Admin API directly
  (they are not CORS-enabled). All calls go through this app's own Next.js
  API routes (`/api/edge/*`), which exchange the credentials for an OAuth
  token (`client_credentials` grant, audience `https://api.sitecorecloud.io`)
  and proxy the request. Tokens are cached in server memory until shortly
  before expiry and are never returned to the browser.

## Getting started

```bash
npm install
npm run dev
```

The app is served at the root route (`/`) but cannot be used directly in a
browser — the Marketplace SDK requires the app to run inside SitecoreAI.

### Register the app in SitecoreAI

1. Expose your dev server over HTTPS (e.g. `ngrok http 5001`) or deploy
   (e.g. Vercel).
2. In the Sitecore Cloud Portal, open the **Developer Studio** and register a
   new Marketplace app with the **Fullscreen** extension point pointing to
   `https://<your-host>/`.
3. Install the app for your organization and open it from the apps menu.

### Create Edge administration credentials

1. In SitecoreAI **Deploy** (or Cloud Portal), create an **Edge
   administration** client for the environment you want to manage.
2. Open the console, click **Configure credentials**, paste the Client ID and
   Client Secret, click **Test connection**, then **Save**.

## API routes

All routes read the credentials from the `x-edge-client-id` /
`x-edge-client-secret` request headers and proxy to
`https://edge.sitecorecloud.io/api/admin/v1`:

| Route | Methods | Purpose |
|---|---|---|
| `/api/edge/validate` | POST | Validate credentials (token + `GET /settings`) |
| `/api/edge/webhooks` | GET, POST | List / create webhooks |
| `/api/edge/webhooks/[id]` | GET, PUT, DELETE | Read / update / delete a webhook |
| `/api/edge/cache` | DELETE | Clear the delivery cache |
| `/api/edge/content` | DELETE | Delete all environment content from Edge |
| `/api/edge/settings` | GET, PUT | Read / update environment settings |

Error responses use a typed JSON shape:
`{ "error": "invalid_credentials" | "validation" | "edge_api_error" | "upstream_unreachable" | "missing_credentials", ... }`.

The routes have no Marketplace SDK dependency, so you can exercise them
locally with `curl` using a real Edge admin client:

```bash
curl -H "x-edge-client-id: <id>" -H "x-edge-client-secret: <secret>" \
  http://localhost:5001/api/edge/webhooks
```
