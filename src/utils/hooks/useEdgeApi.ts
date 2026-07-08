"use client";

import { useCallback, useMemo } from "react";
import type { EdgeApiError } from "@/src/types/edge";

export interface EdgeApiCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Error thrown by the client-side Edge API wrapper. Carries the typed error
 * code returned by the app's own API routes so the UI can react (e.g. reopen
 * the settings modal on invalid_credentials).
 */
export class EdgeApiClientError extends Error {
  constructor(
    public code: EdgeApiError["error"],
    public status: number,
    public detail?: string,
  ) {
    super(detail || code);
    this.name = "EdgeApiClientError";
  }
}

export function isInvalidCredentialsError(error: unknown): boolean {
  return (
    error instanceof EdgeApiClientError && error.code === "invalid_credentials"
  );
}

/**
 * Client-side fetch wrapper for the app's /api/edge routes. Injects the
 * credential headers; the server exchanges them for a token and proxies the
 * call to the Experience Edge Admin API.
 */
export function useEdgeApi(credentials: EdgeApiCredentials | null) {
  const call = useCallback(
    async <T>(path: string, init: RequestInit = {}): Promise<T> => {
      if (!credentials) {
        throw new EdgeApiClientError("missing_credentials", 400);
      }

      const response = await fetch(`/api/edge${path}`, {
        ...init,
        headers: {
          "x-edge-client-id": credentials.clientId,
          "x-edge-client-secret": credentials.clientSecret,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
      });

      if (!response.ok) {
        let body: EdgeApiError | null = null;
        try {
          body = (await response.json()) as EdgeApiError;
        } catch {
          // Non-JSON error body
        }
        throw new EdgeApiClientError(
          body?.error ?? "edge_api_error",
          response.status,
          body?.detail,
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    },
    [credentials],
  );

  return useMemo(() => ({ call }), [call]);
}

/**
 * Validates a credential pair against /api/edge/validate without requiring
 * the hook (used by the settings modal before credentials are committed).
 */
export async function validateEdgeCredentials(
  credentials: EdgeApiCredentials,
): Promise<{ ok: true } | { ok: false; error: EdgeApiError["error"]; detail?: string }> {
  const response = await fetch("/api/edge/validate", {
    method: "POST",
    headers: {
      "x-edge-client-id": credentials.clientId,
      "x-edge-client-secret": credentials.clientSecret,
    },
  });

  if (response.ok) {
    return { ok: true };
  }

  let body: EdgeApiError | null = null;
  try {
    body = (await response.json()) as EdgeApiError;
  } catch {
    // Non-JSON error body
  }

  return {
    ok: false,
    error: body?.error ?? "edge_api_error",
    detail: body?.detail,
  };
}
