import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  CLIENT_SECRET_HEADER,
  readCredentials,
  edgeErrorResponse,
  secretErrorResponse,
} from "@/src/lib/edge/request";
import { ensureSealed } from "@/src/lib/edge/secret-crypto";

/**
 * Validates a credential pair by exchanging it for a token and calling
 * GET /settings on the Admin API.
 *
 * On success the sealed form of the secret is returned, which is what the
 * browser persists and sends on every later call. A secret that arrives
 * already sealed is returned unchanged, so the settings dialog can re-test
 * stored credentials without the plaintext ever coming back to the client.
 */
export async function POST(request: Request) {
  const result = readCredentials(request);
  if (!result.ok) {
    return result.response;
  }

  // Fail before touching Edge if this deployment cannot seal secrets — saving
  // plaintext is not an option.
  let sealedSecret: string;
  try {
    sealedSecret = ensureSealed(request.headers.get(CLIENT_SECRET_HEADER)!);
  } catch (error) {
    return secretErrorResponse(error);
  }

  try {
    const response = await edgeFetch(result.credentials, "/settings", {
      method: "GET",
    });
    await readEdgeResponse(response);
    return NextResponse.json({ ok: true, sealedSecret });
  } catch (error) {
    return edgeErrorResponse(error);
  }
}
