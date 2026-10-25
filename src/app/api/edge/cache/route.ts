import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  edgeErrorResponse,
} from "@/src/lib/edge/request";

/** Clears the entire Experience Edge cache for the environment. */
export async function DELETE(request: Request) {
  const auth = await readCredentials(request);
  if (!auth.ok) {
    return auth.response;
  }
  const credentials = auth.credentials;

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
