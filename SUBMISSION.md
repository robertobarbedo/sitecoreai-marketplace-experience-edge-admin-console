# Marketplace submission: Experience Edge Console

Copy-paste text for Sitecore's public-app submission form, in form order.
Replace `{{APP_URL}}` with the production deployment URL before submitting.

## 1. App name

Experience Edge Console

## 2. Headline

<!-- 334 chars -->

Manage Experience Edge from inside SitecoreAI without calling the Admin API by hand. Create, edit, test and delete webhooks, review each webhook's recent runs and auto-disabled state, clear the delivery cache, delete published content, and edit cache TTL settings, using an Edge administration client whose secret is stored encrypted.

## 3. Description

Experience Edge is managed through the Experience Edge Admin REST API, which has no UI in SitecoreAI. Creating a webhook, checking why one stopped firing, or clearing the delivery cache otherwise means requesting an OAuth token and calling the API by hand. Experience Edge Console does it for administrators from inside SitecoreAI. You enter the Client ID and Client Secret of an Edge administration client once; the app stores them in the environment's content tree, with the secret encrypted, and calls the Admin API for you.

Key features:
- Webhook list with label, URI, method, execution mode, the latest run's result and whether Edge has auto-disabled the webhook
- Create and edit webhooks: HTTPS URI, method, custom headers, and OnEnd (body) or OnUpdate (bodyInclude) execution mode
- Webhook details with the run history Edge keeps on each webhook, newest first
- Test a webhook: sends one request to its endpoint and shows status, latency and response
- Delete webhooks with confirmation
- Clear the delivery cache (type CLEAR to confirm)
- Delete all published content of the environment from Edge (type DELETE to confirm)
- Environment settings: content and media cache TTLs and auto-clear flags, plus the raw settings JSON
- Write-only Client Secret: sealed on the server and never shown again

Use cases:
- Set up and debug webhooks that trigger site rebuilds or integrations
- Find out why a webhook was auto-disabled
- Clear the Edge cache after a fix without leaving SitecoreAI
- Tune cache TTLs for an environment

## 4. Financial model

Free

## 5. Categories

Suggested (match to the portal's category list before submitting):
- Developer tools
- Integration
- Publishing

## 6. Screenshots to capture

PNG, shown as 600×900 thumbnails. Capture during live QA.

1. Webhooks tab with several webhooks, including a last-run success/failure and a disabled badge.
2. Create/edit webhook dialog (URI, method, headers, execution mode and body).
3. Webhook details dialog with the run history.
4. Test result for a webhook (status, latency, response).
5. Cache tab with the Clear cache confirmation (CLEAR typed).
6. Settings tab with cache TTLs and auto-clear flags.

## 7. Links

- Website: https://github.com/robertobarbedo/sitecoreai-marketplace-experience-edge-admin-console
- Support: https://github.com/robertobarbedo/sitecoreai-marketplace-experience-edge-admin-console/issues
- Privacy policy: https://github.com/robertobarbedo/sitecoreai-marketplace-experience-edge-admin-console/blob/main/PRIVACY.md
- Terms of service: https://github.com/robertobarbedo/sitecoreai-marketplace-experience-edge-admin-console/blob/main/TERMS.md

## 8. Data usage disclosure

Paste from `DATA-USAGE.md`.

Summary: the Edge administration Client ID and the sealed Client Secret are stored in one settings item in the customer's own content tree, written through the Marketplace SDK with the user's permissions. Requests go from the browser to the app's own signed-in API routes and from there only to `auth.sitecorecloud.io` and `edge.sitecorecloud.io` (and, for a webhook test, to that webhook's own endpoint); nothing is persisted server-side. Server audit logs (no tokens, secrets, settings or webhook content) are kept for 90 days.

## 9. AI usage disclosure switch

Off. The app does not use AI or machine learning.

## 10. Configuration tab

- Extension point: **Full Screen**, route `/`.
- API access: **SitecoreAI APIs** (the app calls `xmc.authoring.graphql` through the Marketplace SDK to load/save its settings item, plus `application.context`; the Edge Admin API is called server-side with the customer's Edge administration client).
- Permissions: none required by the code (no `window.open`, clipboard or file downloads). Note: the credentials help text links to SitecoreAI Deploy with `target="_blank"`; if that link doesn't open in the portal iframe during QA, enable **Pop-ups**.
- Deployment URL: `{{APP_URL}}`
- Client credentials (custom authorization): **Yes**. Every `/api/*` route requires a Sitecore Cloud token issued to this app. Create Single-page app credentials and register:
  - Allowed callback URL: `{{APP_URL}}/` (with trailing slash)
  - Logout URL, web origin, CORS origin: `{{APP_URL}}`
- Environment variables on the host:
  - `NEXT_PUBLIC_AUTH0_CLIENT_ID` (required)
  - `NEXT_PUBLIC_SITECORE_APP_ID` (required)
  - `EDGE_SECRET_ENCRYPTION_KEY` (required; server-only, 16+ characters, `openssl rand -base64 32`, keep stable)
  - Optional: `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_AUTH0_AUDIENCE`, `NEXT_PUBLIC_AUTH0_SCOPE`, `AUTH0_ISSUER`, `CSP_FRAME_ANCESTORS`
- App logo: `public/icon.svg`

## 11. Submission details (visible only to Sitecore)

- Contact name: `Roberto Barbedo`
- Contact email: `rb205@proton.me`

**App functionality**

Experience Edge Console is a Next.js 15 full-stack app on the Full Screen extension point. The browser uses the Marketplace SDK (`xmc.authoring.graphql`) only to read and write the app's settings item at `/sitecore/system/Modules/Marketplace/ExperienceEdgeAdminConsole/Settings` (Client ID, sealed Client Secret, timestamp). Because the Sitecore Cloud token endpoint and the Edge Admin API don't allow CORS, all Edge calls go through the app's own `/api/edge/*` routes (validate, webhooks, webhook test, cache, content, settings). The browser calls them with a Sitecore Cloud token from custom authorization (Auth0 SPA client credentials); the server verifies it, unseals the Client Secret, obtains a `client_credentials` token from `auth.sitecorecloud.io` (cached in memory, never returned to the browser) and calls `https://edge.sitecorecloud.io/api/admin/v1`. The app has no database; Edge settings are read from and written to Experience Edge directly.

**Business value / alignment with Sitecore standards**

The app gives administrators a UI for the Experience Edge Admin API, which otherwise has none, so webhook setup, troubleshooting and cache clearing don't require hand-written API calls. It uses only supported Marketplace SDK APIs and the documented Sitecore Cloud token endpoint and Edge Admin API; content-tree access runs with the signed-in user's own permissions. The UI follows the Blok design language (Tailwind CSS v4, Radix UI). Security measures: middleware verifying a Sitecore Cloud token on every `/api/*` route (signature, issuer, audience, expiry and `azp` bound to this app's client ID); the Client Secret sealed with AES-256-GCM (HKDF-SHA256 key from `EDGE_SECRET_ENCRYPTION_KEY`, organization ID and Client ID as additional authenticated data), write-only in the UI, with no plaintext fallback; an SSRF guard on webhook tests (target read from the Admin API by ID, https on port 443 only, DNS-pinned public-address check, no redirects, 15 s timeout, response capped); typed-confirmation for destructive actions; security headers on every response (HSTS, CSP frame-ancestors limited to SitecoreAI, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) and `Cache-Control: no-store` on API routes; and JSON audit logging of sign-in decisions and sensitive operations without tokens, secrets or content. Fonts are self-hosted; no analytics.

**Licensing note**

Next.js lists sharp (LGPL-3.0 libvips) as an optional dependency for image optimization; this app doesn't use next/image and sets images.unoptimized, so sharp is never loaded. lightningcss (MPL-2.0) is a build-time-only dependency of Tailwind CSS and is not shipped.

## 12. Pre-submit checklist

- [ ] Live QA: Configure credentials, Test connection, Save; reload and confirm the secret is not shown
- [ ] Live QA: webhook create, edit, details/run history, test, delete
- [ ] Live QA: Clear cache and environment settings update (Delete all content only on a disposable environment)
- [ ] `NEXT_PUBLIC_AUTH0_CLIENT_ID`, `NEXT_PUBLIC_SITECORE_APP_ID` and `EDGE_SECRET_ENCRYPTION_KEY` set on the production host; app rebuilt
- [ ] Production client credentials registered with `{{APP_URL}}` callback, logout, web origin and CORS URLs
- [ ] Screenshots captured (PNG), with no real Client ID/secret or webhook URLs visible
- [ ] `{{APP_URL}}` replaced with the production deployment URL in this form
