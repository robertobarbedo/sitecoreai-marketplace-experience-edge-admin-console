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
  /** Body to post. Experience Edge only populates it when executionMode is OnEnd. */
  body?: string;
  /**
   * Extra JSON object merged into the request body. Experience Edge only
   * allows it when executionMode is OnUpdate.
   */
  bodyInclude?: string;
  executionMode?: WebhookExecutionMode;
}

/**
 * One logged execution of a webhook. Experience Edge keeps the most recent
 * runs on the webhook object itself (`lastRuns`) — there is no separate
 * history endpoint.
 */
export interface WebhookRun {
  /** When the execution log entry was created. */
  timestamp?: string;
  success?: boolean;
  /** Error message; Edge only sets it for failed runs. */
  message?: string;
}

export interface Webhook extends WebhookInput {
  id: string;
  tenantId?: string;
  createdBy?: string;
  created?: string;
  /** Results of the latest executions, newest-first once normalized. */
  lastRuns?: WebhookRun[];
  /**
   * Experience Edge disables a webhook automatically after 10 consecutive
   * failed executions (a run that does not answer within 30 seconds counts
   * as failed).
   */
  disabled?: boolean;
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
    | "secret_unreadable"
    /** The caller's sign-in carries no Sitecore Cloud organization to bind secrets to. */
    | "organization_unknown";
  status?: number;
  field?: string;
  detail?: string;
}
