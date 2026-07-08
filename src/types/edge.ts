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
    | "upstream_unreachable";
  status?: number;
  field?: string;
  detail?: string;
}
