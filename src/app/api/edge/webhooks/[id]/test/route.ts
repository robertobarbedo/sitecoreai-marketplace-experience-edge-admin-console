import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  edgeErrorResponse,
  jsonError,
} from "@/src/lib/edge/request";
import {
  BlockedUrlError,
  parsePublicHttpsUrl,
  publicHttpsRequest,
} from "@/src/lib/edge/public-https";
import { describeRequestError } from "@/src/utils/ssrfGuard";
import type { Webhook, WebhookTestResult } from "@/src/types/edge";

/**
 * Fires a test call at a configured webhook's endpoint, the way Experience
 * Edge would: same URI, method, headers and body. The target is read from the
 * Admin API by id rather than taken from the request — the browser can only
 * name a webhook that already exists. Because anyone with the credentials
 * can create a webhook with any URI, the call itself is SSRF-guarded too
 * (src/lib/edge/public-https.ts): https:443 to public addresses only, checked
 * at connect time, no redirects followed.
 */

type RouteContext = { params: Promise<{ id: string }> };

const TEST_TIMEOUT_MS = 15_000;
const RESPONSE_BODY_LIMIT = 4_000;

/** Sent when the webhook has no body configured, so the call carries something recognizable. */
function defaultTestBody(webhook: Webhook): string {
  return JSON.stringify(
    {
      test: true,
      source: "Experience Edge Admin Console",
      webhookId: webhook.id,
      webhookLabel: webhook.label,
      message:
        "Test call from the Experience Edge Admin Console — not a real publish notification.",
      sentAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await readCredentials(request);
  if (!auth.ok) {
    return auth.response;
  }
  const credentials = auth.credentials;

  const { id } = await context.params;

  let webhook: Webhook | null;
  try {
    const response = await edgeFetch(
      credentials,
      `/webhooks/${encodeURIComponent(id)}`,
      { method: "GET" },
    );
    webhook = await readEdgeResponse<Webhook>(response);
  } catch (error) {
    return edgeErrorResponse(error);
  }

  if (!webhook?.uri) {
    return jsonError("validation", 404, {
      detail: "Webhook not found, or it has no URI configured",
    });
  }
  try {
    parsePublicHttpsUrl(webhook.uri);
  } catch (error) {
    return jsonError("validation", 400, {
      field: "uri",
      detail: `This webhook can't be tested from here: ${
        error instanceof Error ? error.message : "URL is not allowed"
      }`,
    });
  }

  // GET/DELETE carry no body; anything else sends the configured body, or a
  // labelled test payload when none is set.
  const sendsBody = webhook.method !== "GET" && webhook.method !== "DELETE";
  const body = sendsBody ? (webhook.body || defaultTestBody(webhook)) : undefined;

  const startedAt = Date.now();
  try {
    const response = await publicHttpsRequest(webhook.uri, {
      method: webhook.method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(webhook.headers ?? {}),
      },
      body,
      timeoutMs: TEST_TIMEOUT_MS,
      maxResponseChars: RESPONSE_BODY_LIMIT,
    });

    return NextResponse.json({
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      latencyMs: Date.now() - startedAt,
      requestMethod: webhook.method,
      requestUri: webhook.uri,
      requestBody: body,
      responseBody: response.body,
      responseTruncated: response.truncated,
    } satisfies WebhookTestResult);
  } catch (error) {
    if (error instanceof BlockedUrlError) {
      return jsonError("validation", 400, {
        field: "uri",
        detail: `This webhook can't be tested from here: ${error.message}`,
      });
    }
    // A refused connection, DNS failure or timeout is a legitimate test
    // outcome, not an app error — report it as a result the user can read.
    return NextResponse.json({
      ok: false,
      latencyMs: Date.now() - startedAt,
      requestMethod: webhook.method,
      requestUri: webhook.uri,
      requestBody: body,
      errorMessage:
        error instanceof Error && error.name === "TimeoutError"
          ? `No response within ${TEST_TIMEOUT_MS / 1000} seconds`
          : describeRequestError(error),
    } satisfies WebhookTestResult);
  }
}
