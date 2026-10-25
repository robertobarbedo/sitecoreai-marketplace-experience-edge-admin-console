import { NextResponse } from "next/server";
import type { EdgeApiError } from "@/src/types/edge";
import {
  EdgeApiRequestError,
  InvalidCredentialsError,
  UpstreamUnreachableError,
  type EdgeCredentialPair,
} from "./admin-client";
import {
  EncryptionUnavailableError,
  SecretSealError,
  openSecret,
} from "./secret-crypto";

export const CLIENT_ID_HEADER = "x-edge-client-id";
export const CLIENT_SECRET_HEADER = "x-edge-client-secret";

export type CredentialResult =
  | { ok: true; credentials: EdgeCredentialPair }
  | { ok: false; response: NextResponse };

/**
 * Reads the credential headers and unseals the client secret. Only the sealed
 * form bound to the sent client ID is accepted: plaintext, the unbound v1
 * format and another client's ciphertext are rejected (the validate route,
 * which seals secrets, reads the raw headers itself).
 */
export function readCredentials(request: Request): CredentialResult {
  const raw = readRawCredentials(request);
  if (!raw) {
    return { ok: false, response: missingCredentialsResponse() };
  }

  try {
    return {
      ok: true,
      credentials: {
        clientId: raw.clientId,
        clientSecret: openSecret(raw.clientSecret, raw.clientId),
      },
    };
  } catch (error) {
    return { ok: false, response: secretErrorResponse(error) };
  }
}

/** The credential headers as sent, without unsealing; null if either is missing. */
export function readRawCredentials(
  request: Request,
): { clientId: string; clientSecret: string } | null {
  const clientId = request.headers.get(CLIENT_ID_HEADER);
  const clientSecret = request.headers.get(CLIENT_SECRET_HEADER);
  return clientId && clientSecret ? { clientId, clientSecret } : null;
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

/** Maps sealing/unsealing failures to a JSON error response. */
export function secretErrorResponse(error: unknown): NextResponse {
  if (error instanceof EncryptionUnavailableError) {
    console.error("Secret encryption unavailable:", error.message);
    return jsonError("encryption_unavailable", 500, { detail: error.message });
  }
  if (error instanceof SecretSealError) {
    return jsonError("secret_unreadable", 400, { detail: error.message });
  }
  throw error;
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
  if (
    error instanceof EncryptionUnavailableError ||
    error instanceof SecretSealError
  ) {
    return secretErrorResponse(error);
  }

  console.error("Unexpected Edge API error:", error);
  return jsonError("edge_api_error", 500, {
    detail: "Unexpected server error",
  });
}
