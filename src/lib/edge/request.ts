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
  type SecretBinding,
} from "./secret-crypto";
import { requireSitecoreUser } from "@/src/lib/marketplace-auth/server";

export const CLIENT_ID_HEADER = "x-edge-client-id";
export const CLIENT_SECRET_HEADER = "x-edge-client-secret";

export type CredentialResult =
  | { ok: true; credentials: EdgeCredentialPair }
  | { ok: false; response: NextResponse };

/**
 * The verified Sitecore Cloud organization of the caller. The middleware has
 * already checked the token; it is verified again here so a sealed secret can
 * never be opened without a trusted organization, whatever the matcher covers.
 * Fails closed when the token carries no `org_id`.
 */
export async function readCallerOrganization(
  request: Request,
): Promise<{ ok: true; organizationId: string } | { ok: false; response: NextResponse }> {
  const auth = await requireSitecoreUser(request);
  if (!auth.ok) return auth;
  if (!auth.user.organizationId) {
    return {
      ok: false,
      response: jsonError("organization_unknown", 403, {
        detail: "Your sign-in does not identify a Sitecore Cloud organization, so stored credentials cannot be used.",
      }),
    };
  }
  return { ok: true, organizationId: auth.user.organizationId };
}

/**
 * Reads the credential headers and unseals the client secret. Only the sealed
 * form bound to the caller's organization and the sent client ID is accepted:
 * plaintext, older formats and another organization's or client's ciphertext
 * are rejected (the validate route, which seals secrets, reads the raw
 * headers itself).
 */
export async function readCredentials(request: Request): Promise<CredentialResult> {
  const raw = readRawCredentials(request);
  if (!raw) {
    return { ok: false, response: missingCredentialsResponse() };
  }

  const org = await readCallerOrganization(request);
  if (!org.ok) return org;

  const binding: SecretBinding = {
    organizationId: org.organizationId,
    clientId: raw.clientId,
  };
  try {
    return {
      ok: true,
      credentials: {
        clientId: raw.clientId,
        clientSecret: openSecret(raw.clientSecret, binding),
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
    return jsonError("encryption_unavailable", 500, {
      detail: "The server is not configured to encrypt client secrets.",
    });
  }
  if (error instanceof SecretSealError) {
    return jsonError("secret_unreadable", 400, { detail: error.message });
  }
  throw error;
}

/** What the browser is told for an Experience Edge error status; the upstream body only goes to the server log. */
function edgeStatusMessage(status: number): string {
  if (status === 400 || status === 422) {
    return "Experience Edge rejected the request as invalid.";
  }
  if (status === 403) {
    return "These credentials are not allowed to perform this action.";
  }
  if (status === 404) return "Experience Edge could not find the requested resource.";
  if (status === 409) return "The request conflicts with the current state in Experience Edge.";
  if (status === 429) return "Experience Edge is rate limiting requests; try again shortly.";
  if (status >= 500) return "Experience Edge failed to process the request.";
  return "Experience Edge returned an error.";
}

/**
 * Maps errors thrown by edgeFetch/readEdgeResponse to a JSON error response.
 * Upstream response bodies are logged on the server and never returned.
 */
export function edgeErrorResponse(error: unknown): NextResponse {
  if (error instanceof InvalidCredentialsError) {
    console.warn("Edge credentials rejected:", error.message);
    return jsonError("invalid_credentials", 401, {
      detail: "Experience Edge rejected the Client ID or Client Secret.",
    });
  }
  if (error instanceof UpstreamUnreachableError) {
    return jsonError("upstream_unreachable", 502);
  }
  if (error instanceof EdgeApiRequestError) {
    console.error(`Edge Admin API error (${error.status}):`, error.detail);
    return jsonError("edge_api_error", error.status, {
      status: error.status,
      detail: edgeStatusMessage(error.status),
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
