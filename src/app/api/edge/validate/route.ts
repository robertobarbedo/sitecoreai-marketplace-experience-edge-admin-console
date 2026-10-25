import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readRawCredentials,
  missingCredentialsResponse,
  edgeErrorResponse,
  secretErrorResponse,
} from "@/src/lib/edge/request";
import { sealForClient } from "@/src/lib/edge/secret-crypto";

/**
 * Validates a credential pair by exchanging it for a token and calling
 * GET /settings on the Admin API.
 *
 * On success the sealed form of the secret, bound to the client ID, is
 * returned — that is what the browser persists and sends on every later call.
 * This is the only route that accepts a secret in another form: plaintext
 * (just typed in the settings dialog) or the unbound v1 format (stored by an
 * older version), which is how both get migrated.
 * A current sealed secret is returned unchanged, so the settings dialog can
 * re-test stored credentials without the plaintext ever coming back.
 */
export async function POST(request: Request) {
  const raw = readRawCredentials(request);
  if (!raw) {
    return missingCredentialsResponse();
  }

  // Fail before touching Edge if this deployment cannot seal secrets — saving
  // plaintext is not an option.
  let secret: { plaintext: string; sealed: string };
  try {
    secret = sealForClient(raw.clientSecret, raw.clientId);
  } catch (error) {
    return secretErrorResponse(error);
  }

  try {
    const response = await edgeFetch(
      { clientId: raw.clientId, clientSecret: secret.plaintext },
      "/settings",
      { method: "GET" },
    );
    await readEdgeResponse(response);
    return NextResponse.json({ ok: true, sealedSecret: secret.sealed });
  } catch (error) {
    return edgeErrorResponse(error);
  }
}
