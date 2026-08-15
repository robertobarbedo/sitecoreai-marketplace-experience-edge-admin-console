import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  edgeErrorResponse,
  jsonError,
} from "@/src/lib/edge/request";
import type { Webhook, WebhookTestResult } from "@/src/types/edge";

/**
 * Fires a test call at a configured webhook's endpoint, the way Experience
 * Edge would: same URI, method, headers and body. The target is read from the
 * Admin API by id rather than taken from the request — the browser can only
 * name a webhook that already exists, never an arbitrary URL for this server
 * to call.
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
  const auth = readCredentials(request);
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
  if (!webhook.uri.toLowerCase().startsWith("https://")) {
    return jsonError("validation", 400, {
      field: "uri",
      detail: "Webhook URI must use HTTPS",
    });
  }

  // GET/DELETE carry no body; anything else sends the configured body, or a
  // labelled test payload when none is set.
  const sendsBody = webhook.method !== "GET" && webhook.method !== "DELETE";
  const body = sendsBody ? (webhook.body || defaultTestBody(webhook)) : undefined;

  const startedAt = Date.now();
  try {
    const response = await fetch(webhook.uri, {
      method: webhook.method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(webhook.headers ?? {}),
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });

    const text = await response.text().catch(() => "");
    return NextResponse.json({
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      latencyMs: Date.now() - startedAt,
      requestMethod: webhook.method,
      requestUri: webhook.uri,
      requestBody: body,
      responseBody: text.slice(0, RESPONSE_BODY_LIMIT),
      responseTruncated: text.length > RESPONSE_BODY_LIMIT,
    } satisfies WebhookTestResult);
  } catch (error) {
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
          : error instanceof Error
            ? error.message
            : String(error),
    } satisfies WebhookTestResult);
  }
}
