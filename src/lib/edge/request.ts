import { NextResponse } from "next/server";
import type { EdgeApiError } from "@/src/types/edge";
import {
  EdgeApiRequestError,
  InvalidCredentialsError,
  UpstreamUnreachableError,
  type EdgeCredentialPair,
} from "./admin-client";

export const CLIENT_ID_HEADER = "x-edge-client-id";
export const CLIENT_SECRET_HEADER = "x-edge-client-secret";

export function readCredentials(request: Request): EdgeCredentialPair | null {
  const clientId = request.headers.get(CLIENT_ID_HEADER);
  const clientSecret = request.headers.get(CLIENT_SECRET_HEADER);

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

export function jsonError(
  error: EdgeApiError["error"],
  status: number,
  extra: Partial<EdgeApiError> = {},
): NextResponse {
  return NextResponse.json({ error, ...extra } satisfies EdgeApiError, {
    status,
  });
}

export function missingCredentialsResponse(): NextResponse {
  return jsonError("missing_credentials", 400, {
    detail: `Missing ${CLIENT_ID_HEADER} / ${CLIENT_SECRET_HEADER} headers`,
  });
}

/**
 * Maps errors thrown by edgeFetch/readEdgeResponse to a JSON error response.
 */
export function edgeErrorResponse(error: unknown): NextResponse {
  if (error instanceof InvalidCredentialsError) {
    return jsonError("invalid_credentials", 401, { detail: error.message });
  }
  if (error instanceof UpstreamUnreachableError) {
    return jsonError("upstream_unreachable", 502);
  }
  if (error instanceof EdgeApiRequestError) {
    return jsonError("edge_api_error", error.status, {
      status: error.status,
      detail: error.detail,
    });
  }

  console.error("Unexpected Edge API error:", error);
  return jsonError("edge_api_error", 500, {
    detail: error instanceof Error ? error.message : "Unknown error",
  });
}
