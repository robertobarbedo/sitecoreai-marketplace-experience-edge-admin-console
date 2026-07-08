import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  missingCredentialsResponse,
  edgeErrorResponse,
} from "@/src/lib/edge/request";

/** Clears the entire Experience Edge cache for the environment. */
export async function DELETE(request: Request) {
  const credentials = readCredentials(request);
  if (!credentials) {
    return missingCredentialsResponse();
  }

  try {
    const response = await edgeFetch(credentials, "/cache", {
      method: "DELETE",
    });
    await readEdgeResponse(response);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return edgeErrorResponse(error);
  }
}
