/**
 * Shared types for the Experience Edge Admin API.
 * Used by both the API route handlers and the client components.
 */

export type WebhookMethod = "POST" | "PUT" | "GET" | "DELETE";

export type WebhookExecutionMode = "OnEnd" | "OnUpdate";

export interface WebhookInput {
  label: string;
  uri: string;
  method: WebhookMethod;
  headers?: Record<string, string>;
  body?: string;
  executionMode?: WebhookExecutionMode;
}

export interface Webhook extends WebhookInput {
  id: string;
  tenantId?: string;
  createdBy?: string;
  created?: string;
}

/**
 * Outcome of a manual test call at a webhook's endpoint. A non-2xx status or
 * an unreachable endpoint is a RESULT, not an error — both come back here
 * with `ok: false` so the UI can show what happened.
 */
export interface WebhookTestResult {
  ok: boolean;
  /** Absent when the endpoint could not be reached at all. */
  status?: number;
  statusText?: string;
  latencyMs: number;
  requestMethod: WebhookMethod;
  requestUri: string;
  /** What was sent — the configured body, or a generated test payload. */
  requestBody?: string;
  responseBody?: string;
  responseTruncated?: boolean;
  /** Set instead of status when the request itself failed (DNS, refused, timeout). */
  errorMessage?: string;
}

/**
 * Environment settings returned by GET /settings. The exact shape can grow
 * over time, so known fields are typed and the rest is passed through.
 */
export interface EdgeSettings {
  contentCacheTtl?: string;
  contentCacheAutoClear?: boolean;
  mediaCacheTtl?: string;
  mediaCacheAutoClear?: boolean;
  [key: string]: unknown;
}

export interface EdgeApiError {
  error:
    | "missing_credentials"
    | "invalid_credentials"
    | "validation"
    | "edge_api_error"
    | "upstream_unreachable"
    /** The server has no EDGE_SECRET_ENCRYPTION_KEY, so secrets cannot be sealed. */
    | "encryption_unavailable"
    /** The stored secret could not be decrypted (key rotated, value tampered). */
    | "secret_unreadable";
  status?: number;
  field?: string;
  detail?: string;
}
