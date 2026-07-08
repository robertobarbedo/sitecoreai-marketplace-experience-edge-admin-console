import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  missingCredentialsResponse,
  edgeErrorResponse,
} from "@/src/lib/edge/request";

/**
 * Validates a credential pair by exchanging it for a token and calling
 * GET /settings on the Admin API.
 */
export async function POST(request: Request) {
  const credentials = readCredentials(request);
  if (!credentials) {
    return missingCredentialsResponse();
  }

  try {
    const response = await edgeFetch(credentials, "/settings", {
      method: "GET",
    });
    await readEdgeResponse(response);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return edgeErrorResponse(error);
  }
}
