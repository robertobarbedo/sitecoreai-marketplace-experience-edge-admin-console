# Privacy Policy

**Last updated: 2026-10-31**

## Overview

This policy explains what data the Experience Edge Console ("the app")
handles, where it goes, what is stored, and how you can exercise your
rights. It applies to the hosted app listed in the Sitecore Marketplace.

## Summary

- The app has no database. Your Experience Edge administration credentials
  are stored in your own SitecoreAI environment, with the Client Secret
  encrypted. The app's servers keep no copy.
- The app uses no analytics, tracking or advertising services and sets no
  cookies.
- The only data kept on the server side are short audit and runtime log
  lines (who called the API, which operation, the outcome and the status),
  retained for 90 days, and short-lived Experience Edge access tokens held in
  server memory.
- Data leaves your browser only in the ways listed under
  [Where data goes](#where-data-goes).

## How the app works

The app runs inside SitecoreAI. It uses two paths:

- **The Marketplace SDK**, with your own SitecoreAI permissions, to read and
  write the app's Settings item through the Sitecore Authoring and
  Management GraphQL API.
- **The app's own server routes** (`/api/edge/*`), which exchange your Edge
  administration credentials for an access token at Sitecore Cloud and call
  the Experience Edge Admin API for you. The browser cannot call those
  Sitecore services directly.

## What data the app handles

- **Edge administration credentials**: the Client ID and Client Secret of
  an Experience Edge administration client that you enter in the settings
  dialog.
- **Experience Edge configuration**: webhook definitions (label, URI,
  method, headers, body, run history) and environment settings (cache TTLs,
  auto-clear flags), read from and written to Experience Edge.
- **Webhook test results**: the status, latency and the first 4,000
  characters of the response from a webhook endpoint you test.
- **Account identifiers**: your Sitecore Cloud user ID (the token's `sub`)
  and organization ID, taken from your access token on every API call.
- **Sign-in tokens**: your Sitecore Cloud access and refresh tokens, kept in
  your browser.

## Where data goes

1. **Sitecore (Marketplace SDK).** Reading and saving the Settings item in
   your environment, and sign-in requests to Sitecore Cloud (see
   [Sign-in](#sign-in)).
2. **The app's own server.** Every Edge operation goes from your browser to
   the app's `/api/edge/*` routes, with your Sitecore Cloud access token
   (which proves you are signed in), the Client ID, and the sealed Client
   Secret in request headers. The server unseals the secret in memory,
   requests an access token from `auth.sitecorecloud.io`, and forwards the
   operation to the Experience Edge Admin API at `edge.sitecorecloud.io`.
   Webhook definitions and settings pass through the server only for the
   duration of the request and are not stored. The plaintext Client Secret
   reaches the server only once, when you enter it, so the server can test
   and seal it.
3. **Your webhook endpoints.** When you test a webhook, the app's server
   sends one request with the webhook's configured method, headers and body
   (or a labelled test payload) to the webhook's own HTTPS URI.

The app does not sell or share data with anyone else.

## What is stored and where

| Data | Where | Retention |
| --- | --- | --- |
| Settings item: Client ID, sealed Client Secret, last-updated time | Your SitecoreAI environment, at `/sitecore/system/Modules/Marketplace/ExperienceEdgeAdminConsole/Settings` | Until you delete the item |
| Experience Edge access tokens | The app server's memory, per server instance | Until 60 seconds before the token expires, or until the instance stops |
| Audit log lines: time (UTC), API path and method, event (for example `auth`, `edge.cache.clear`, `edge.webhook.update`), outcome, HTTP and upstream status, Sitecore user ID, organization ID, denial reason | The publisher's server logs (Vercel runtime logs and the publisher's log store) | 90 days |
| Experience Edge error messages, for troubleshooting | The publisher's server logs | 90 days |
| Standard request metadata recorded by the hosting provider (IP address, time, path, user agent) | Vercel | 90 days at most |
| Sign-in tokens and current organization ID | Your browser's `localStorage` | Until you sign out, the session expires, or you clear site data |

Log lines never contain tokens, Client Secrets, webhook definitions or
settings values. Webhooks and environment settings are stored by
Experience Edge itself, not by the app.

## Who can access it

- **Settings item:** anyone with read access to that item in your
  SitecoreAI environment. They see only the sealed secret, which cannot be
  opened without the app deployment's encryption key and a signed-in user
  of your organization.
- **Server logs:** only the app's maintainer, for operating, securing and
  troubleshooting the app, and the hosting provider as a sub-processor.
- **Browser storage:** only you, on your own device.

## How data is protected

- All traffic uses HTTPS (TLS 1.2 or later) with HSTS.
- Every API route verifies your Sitecore Cloud access token (signature,
  issuer, audience, expiry and that it was issued to this app) before
  acting.
- The Client Secret is sealed on the server with AES-256-GCM, bound to your
  organization and the Client ID. Only the sealed value is stored in
  Sitecore, held by the browser, or sent on later requests. It is never
  shown again in the UI.
- Experience Edge access tokens stay on the server and are never returned
  to the browser.
- Webhook tests only reach public HTTPS addresses on port 443; private and
  internal networks are blocked and redirects are not followed.
- Security headers restrict which sites may embed the app.
- Logs are stored with the hosting provider's encryption at rest.

## Sign-in

The app requires you to sign in with your Sitecore Cloud account
(Sitecore's Auth0 tenant at `auth.sitecorecloud.io`). The sign-in is handled
by Sitecore. The app only receives the resulting access and refresh
tokens; the browser sends the refresh token back to Sitecore's sign-in
service to renew your session.

## Local storage

The app uses your browser's local storage for sign-in tokens (access and
refresh tokens) and the current organization ID, so you stay signed in. The
organization ID is kept so that switching organization forces a new
sign-in.

This data stays on your device. The access token is sent only to the app's
own server, and the refresh token only to Sitecore's sign-in service. You
can clear all of it by clearing your browser data for the app.

## Sub-processors and third parties

- **Vercel Inc.** (hosting). Serverless functions run in the United States
  (region `iad1`, Washington, D.C.) unless a deployment sets another region.
  See https://vercel.com/legal/privacy-policy.
- **Sitecore** (sign-in, the SitecoreAI APIs, the Sitecore Cloud token
  endpoint and the Experience Edge Admin API), under your own agreement with
  Sitecore.
- **Your webhook endpoints**, which receive the test requests you send from
  the app's server.

No analytics, tracking or advertising services are used.

## Your rights

Depending on where you live (for example under the GDPR or CCPA), you may
have the right to access, correct, delete, restrict or object to the
processing of your personal data, and to receive a copy of it.

To make a request, email roberto.barbedo@msqdx.com with the subject "Data request".
Include your Sitecore Cloud organization ID and, if you know it, your user
ID, so we can find the matching log lines. We answer within 30 days. The
only personal data the publisher holds is in the server logs described
above. You can also complain to your local data protection authority.

## Deletion

- **Credentials:** delete the item
  `/sitecore/system/Modules/Marketplace/ExperienceEdgeAdminConsole/Settings`
  (or the whole `ExperienceEdgeAdminConsole` folder) in your SitecoreAI
  environment. If you used the app before its settings moved, also delete
  `/sitecore/system/Modules/ExperienceEdgeAdminConsole`. You can also revoke
  the Edge administration client in the Cloud Portal.
- **Access tokens** in server memory expire on their own and are dropped
  when the server instance stops.
- **Server logs** are deleted automatically after 90 days. On a verified
  request we delete matching log lines sooner where the log store allows it.
- **Browser data** is deleted when you sign out or clear site data for the
  app.

## Changes to this policy

We may update this policy from time to time. Changes are published in this
file and reflected in the "Last updated" date at the top. Significant
changes are noted in the repository's release notes.

## Contact

Questions about this policy: email roberto.barbedo@msqdx.com or open an issue at
https://github.com/robertobarbedo/sitecoreai-marketplace-experience-edge-admin-console/issues.
