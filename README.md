# Experience Edge Console

A SitecoreAI Marketplace app that gives administrators a UI for the Experience
Edge Admin API: webhooks, cache and environment settings.

Experience Edge is managed through the
[Experience Edge Admin REST API](https://doc.sitecore.com/sai/en/developers/sitecoreai/experience-edge/experience-edge-apis/admin-rest-api.html),
which has no UI in SitecoreAI (XM Cloud). Creating a webhook, checking why one
stopped firing, or clearing the delivery cache otherwise means requesting an
OAuth token and calling the API by hand.

This app does it from inside SitecoreAI. You enter the Client ID and Client
Secret of an Edge administration client once. The app stores them in the
environment's content tree, with the secret encrypted, and calls the Admin API
for you through its own server routes.

## Features

- **Webhook list**: label, URI, method, execution mode, the latest run's
  result, and whether Experience Edge has auto-disabled the webhook
- **Create and edit webhooks**: label, HTTPS URI, method (POST, PUT, GET,
  DELETE), custom headers, and execution mode (`OnEnd` with a `body`, or
  `OnUpdate` with a `bodyInclude` JSON object)
- **Webhook details and run history**: the execution log (`lastRuns`) that
  Edge keeps on each webhook, newest first, re-fetched when the dialog opens
- **Test a webhook**: sends one request to the webhook's endpoint with its
  configured method, headers and body (or a labelled test payload) and shows
  the status, latency and response
- **Delete webhooks**, with a confirmation step
- **Clear cache**: clears the Experience Edge delivery cache for the
  environment (you must type `CLEAR` to confirm)
- **Delete all content**: removes all published content of the environment
  from Experience Edge (you must type `DELETE` to confirm)
- **Environment settings**: view and edit the content and media cache TTLs
  and their auto-clear flags, plus a read-only view of the raw settings JSON
- **Encrypted, write-only Client Secret**: sealed on the server, never shown
  again in the UI

## How it works

- **Extension point:** Full Screen, served from the root route `/`.
- **Sitecore APIs:**
  - Authoring and Management GraphQL, through the Marketplace SDK
    (`@sitecore-marketplace-sdk/client` and `/xmc`), with the signed-in user's
    permissions. It is used only to read and write the app's own settings item.
  - Sitecore Cloud token endpoint (`https://auth.sitecorecloud.io/oauth/token`):
    `client_credentials` grant, audience `https://api.sitecorecloud.io`.
  - Experience Edge Admin API (`https://edge.sitecorecloud.io/api/admin/v1`):
    `/webhooks`, `/cache`, `/content`, `/settings`.

The token endpoint and the Admin API do not allow CORS, so the browser never
calls them. The data flow is:

```
Browser (inside SitecoreAI)
  ├─ Marketplace SDK ──> Authoring GraphQL (load/save the Settings item)
  └─ authedFetch ──> this app's /api/edge/* routes
                        ├─ verify Sitecore Cloud sign-in (src/middleware.ts)
                        ├─ unseal the Client Secret
                        ├─ token from auth.sitecorecloud.io (cached in memory)
                        └─ Experience Edge Admin API
```

Tokens are cached in server memory until 60 seconds before they expire and
are never returned to the browser. If Edge answers 401, the cached token is
dropped and the request is retried once.

### Webhook run history

Experience Edge has no separate history endpoint. Each webhook object returns
`lastRuns: [{ timestamp, success, message }]` and a `disabled` flag. Edge
disables a webhook after 10 consecutive failed runs, and a run that gets no
answer within 30 seconds counts as failed. See
[webhook objects](https://doc.sitecore.com/sai/en/developers/sitecoreai/experience-edge/webhook-objects/webhook-objects.html).
The app sorts the runs newest first. Edge does not record the test calls this
console sends, so they never appear in `lastRuns`.

### API routes

Every route requires a signed-in Sitecore user of this app
(`Authorization: Bearer <Sitecore Cloud token>`). The routes read the
credentials from the `x-edge-client-id` and `x-edge-client-secret` request
headers and proxy to the Admin API.

| Route | Methods | Purpose |
|---|---|---|
| `/api/edge/validate` | POST | Validate credentials (token + `GET /settings`) and return the sealed secret |
| `/api/edge/webhooks` | GET, POST | List / create webhooks (URI must be `https://`) |
| `/api/edge/webhooks/[id]` | GET, PUT, DELETE | Read / update (URI must be `https://`) / delete a webhook |
| `/api/edge/webhooks/[id]/test` | POST | Send a test request to the webhook's endpoint (see [Security and privacy](#security-and-privacy)) |
| `/api/edge/cache` | DELETE | Clear the delivery cache |
| `/api/edge/content` | DELETE | Delete all environment content from Edge |
| `/api/edge/settings` | GET, PUT | Read / update environment settings |

Errors come back as JSON:
`{ "error": <code>, "status"?, "field"?, "detail"? }`, where `<code>` is
one of:

| Code | Meaning |
|---|---|
| `missing_credentials` | The `x-edge-client-id` / `x-edge-client-secret` header is missing |
| `invalid_credentials` | The token endpoint or the Admin API rejected the credentials |
| `validation` | Invalid request body, a non-HTTPS webhook URI, or a test target that isn't allowed |
| `edge_api_error` | The Admin API returned another error (its status and body are passed through) |
| `upstream_unreachable` | The Admin API could not be reached |
| `encryption_unavailable` | `EDGE_SECRET_ENCRYPTION_KEY` is missing or shorter than 16 characters |
| `secret_unreadable` | The sealed secret could not be opened (different key, different Client ID, or tampered) |

## Requirements

- A SitecoreAI (XM Cloud) organization and environment.
- Organization Admin (or Owner) rights in the Cloud Portal to create and
  install the app.
- For each user of the app: read and write access to
  `/sitecore/system/Modules/Marketplace` in the master database. The app
  stores its settings there and creates the folders on the first save.
- An **Experience Edge administration client** (Client ID and Client Secret)
  for the environment you want to manage. You create it in the Cloud Portal /
  SitecoreAI Deploy. Marketplace apps have no default access to the Edge Admin
  API.
- **Single-page app** client credentials for this app in the Cloud Portal.
  The app's `/api` routes use them to verify the user's Sitecore Cloud
  sign-in.
- A deployment of this app on a Node.js host, with the environment variables
  listed under [Deploy your own instance](#deploy-your-own-instance).

## Install in SitecoreAI

1. Deploy the app first (see [Deploy your own instance](#deploy-your-own-instance))
   so you have a public HTTPS URL.
2. In the Cloud Portal, open **App Studio** and choose **Create App**.
3. Enter an app name (for example `Experience Edge Console`) and choose type
   **Custom**.
4. Add the **Full Screen** extension point with the route `/`.
5. Under API access, enable **SitecoreAI APIs**.
6. No extra permissions (such as clipboard access) are needed.
7. Set the deployment URL to `https://<your-deployment>/`.
8. Upload [`public/icon.svg`](public/icon.svg) as the app logo.
9. Set up custom authorization: create **Single-page app** client
   credentials for the app. Register your deployment origin (for example
   `https://<your-deployment>`, no path) as the allowed callback URL (with a
   trailing `/`), logout URL, web origin and CORS origin. Put the client ID in
   `NEXT_PUBLIC_AUTH0_CLIENT_ID` and the app ID in
   `NEXT_PUBLIC_SITECORE_APP_ID`, then redeploy.
10. Install the app for your organization and open it from the SitecoreAI apps
    menu.
11. On first use, click **Configure credentials**, paste the Edge
    administration Client ID and Client Secret, click **Test connection**,
    then **Save**.

## Deploy your own instance

```bash
npm install
npm run build
npm start
```

Deploy to Vercel or any Node.js host that runs Next.js, then point the App
Studio deployment URL at it. Set the variables below in the hosting
environment. For local work, copy `.env.example` to `.env.local`.

| Variable | Required | Description |
|---|---|---|
| `EDGE_SECRET_ENCRYPTION_KEY` | Yes | **Server-only secret.** Passphrase (at least 16 characters) from which the AES-256-GCM key that seals the Client Secret is derived. Generate one with `openssl rand -base64 32`. Keep it stable: changing it makes every stored secret unreadable. Never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | Yes | Client ID of the app's Single-page app client credentials from the Cloud Portal. Without it, every `/api` route returns 500. |
| `NEXT_PUBLIC_SITECORE_APP_ID` | Yes | Marketplace app ID, sent as `product_codes=mkp_<id>` at sign-in. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No | Google Analytics 4 measurement ID (`G-XXXXXXXXXX`). Leave empty to disable analytics. |
| `NEXT_PUBLIC_AUTH0_DOMAIN` | No | Defaults to `auth.sitecorecloud.io`. |
| `NEXT_PUBLIC_AUTH0_AUDIENCE` | No | Defaults to `https://api-webapp.sitecorecloud.io`. |
| `NEXT_PUBLIC_AUTH0_SCOPE` | No | Defaults to `openid profile email offline_access`. |
| `AUTH0_ISSUER` | No | Token issuer checked on the server. Defaults to `https://<NEXT_PUBLIC_AUTH0_DOMAIN>/`. |

`NEXT_PUBLIC_*` values are inlined at build time, so rebuild after changing
them.

The app only works inside SitecoreAI. The Marketplace SDK needs the host
iframe, so opening the deployment URL directly in a browser shows "Failed to
connect to Sitecore". For local development, run `npm run dev` (port 5001),
expose it over HTTPS (for example `ngrok http 5001`), and register that URL
in a separate development app in App Studio.

## Configuration

All configuration is in the settings dialog (the gear icon in the header).

- **Client ID / Client Secret** of the Edge administration client. The dialog
  tests the pair before it allows saving.
- Settings are stored as JSON in the `Value` field of
  `/sitecore/system/Modules/Marketplace/ExperienceEdgeAdminConsole/Settings`
  (master database, `en`). The JSON holds `version: 2`, `clientId`,
  `secretCipher` and `updatedAt`. The app creates the `Marketplace` and
  `ExperienceEdgeAdminConsole` folders when it first saves.
- If that item is empty, the app reads from the older location
  `/sitecore/system/Modules/ExperienceEdgeAdminConsole/Settings`. The next
  save always writes to the new path.
- Older settings are upgraded automatically on load: a `version: 1` item with
  a plaintext `clientSecret`, or a secret in the older unbound `v1.` format,
  is re-sealed on the server and the item is rewritten. This erases the
  plaintext.
- Edge environment settings (cache TTLs, auto-clear) are not stored by the
  app. They are read from and written to Experience Edge directly.

## Security and privacy

- **Authentication.** Content-tree access goes through the Marketplace SDK,
  with the signed-in user's own Sitecore permissions. `src/middleware.ts`
  protects every `/api/*` route: it verifies the user's Sitecore Cloud token
  (signature, issuer, audience, expiry, and that `azp` matches this app's
  client ID). If the client ID is not configured, the routes refuse every
  request.
- **Client Secret encryption.** The secret exists in plaintext only on the
  server, at the moment you type it:
  1. The settings dialog posts it to `POST /api/edge/validate`.
  2. The server tests it against Experience Edge and returns it sealed:
     AES-256-GCM, key derived with HKDF-SHA256 from
     `EDGE_SECRET_ENCRYPTION_KEY`, format `v2.<iv>.<tag>.<ciphertext>`
     (base64url), with the Client ID as additional authenticated data.
  3. Only that sealed value is written to the Settings item, kept in browser
     memory, and sent in `x-edge-client-secret`. The server unseals it on each
     request.
- **What this means:**
  - Anyone who can read the content tree, or a serialized or packaged copy of
    the item, cannot use the stored value without the deployment's key.
  - A sealed value only opens together with the Client ID it was sealed for.
  - The data routes accept only the sealed `v2.` form, and only from a
    signed-in user. `/api/edge/validate` is the one route that accepts a
    plaintext or legacy secret, and it returns the sealed form.
  - The secret cannot be read back through the UI. The dialog never prefills
    or reveals it, and only shows that a secret is stored and when it was
    last updated. If you change the Client ID you must enter the secret
    again. Leave the field blank only to re-test the stored pair.
  - If `EDGE_SECRET_ENCRYPTION_KEY` is missing, saving fails with
    `encryption_unavailable`. The app never falls back to plaintext. If you
    change the key, stored secrets return `secret_unreadable` and users must
    enter the credentials again.
- **Where data goes.**
  - The Edge credentials and the request data go only from the browser to
    this app's own server, and from there to `auth.sitecorecloud.io` and
    `edge.sitecorecloud.io`.
  - A webhook test sends the webhook's configured headers and body to the
    webhook's own endpoint.
  - Sign-in goes to Sitecore Cloud's Auth0 tenant. Its refresh token and
    organization ID are kept in the browser's `localStorage`.
  - If `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set, Google Analytics receives page
    views and an app-initialized event tagged `app_name:
    experience-edge-console`. It receives no content, credentials or webhook
    data.
  - The page loads the Inter and JetBrains Mono fonts from Google Fonts.
- **SSRF protection on webhook tests.** The test route reads the target from
  the Admin API by webhook ID, so the browser cannot supply an arbitrary URL.
  The request itself is restricted to:
  - `https` on port 443, with no credentials in the URL;
  - public addresses only, checked inside the socket's own DNS lookup so DNS
    rebinding cannot swap in an internal address;
  - no redirects followed, a 15-second timeout, and the response body capped
    at 4,000 characters.

## Limitations

- One environment per install: the app manages the Edge environment whose
  administration client is configured, and stores one credential pair per
  SitecoreAI environment.
- Delete all content cannot be undone from the console. You have to publish
  again to restore delivery data.
- Webhook tests are sent from this app's server, not by Experience Edge.
  Edge does not record them in the run history, and endpoints that are
  private, not HTTPS, or not on port 443 cannot be tested from here.
- The Settings tab edits the cache TTLs and auto-clear flags. Other settings
  that Edge returns are shown only in the raw JSON view.
- Only the latest runs that Experience Edge keeps on the webhook object are
  shown. Edge has no full history.

## Development

- Next.js 15 (App Router) / React 19 / TypeScript, Tailwind CSS v4, Radix UI,
  class-variance-authority, `@mdi/js` icons, the Marketplace SDK
  (`@sitecore-marketplace-sdk/client`, `@sitecore-marketplace-sdk/xmc`),
  `@auth0/auth0-react` and `jose` for sign-in.
- Dev server: `npm run dev` on port **5001**. `npm run build` type-checks,
  lints and compiles.
- Project structure:
  - `src/app/`: the page (`page.tsx`) and the `/api/edge/*` route handlers
  - `src/lib/edge/`: token exchange, Admin API client, secret sealing,
    SSRF-safe HTTPS requests
  - `src/lib/marketplace-auth/`: the Sitecore Cloud sign-in kit (see its
    [README](src/lib/marketplace-auth/README.md))
  - `src/utils/`: SDK hooks, GraphQL helpers, settings storage
  - `components/`: the Webhooks, Cache and Settings tabs, dialogs, and UI
    primitives
  - `lib/`: shared helpers

## Support

Report bugs and request features by opening an issue in this repository.
This is a community app and is not an official Sitecore product.

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE).
