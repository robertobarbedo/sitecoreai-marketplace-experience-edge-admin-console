import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  edgeErrorResponse,
} from "@/src/lib/edge/request";
import { audited, upstreamStatusOf } from "@/src/app/api/edge/audit";

/** Clears the entire Experience Edge cache for the environment. */
export async function DELETE(request: Request) {
  const auth = await readCredentials(request);
  if (!auth.ok) {
    return audited(request, "edge.cache.clear", auth.response);
  }
  const credentials = auth.credentials;

  try {
    const response = await edgeFetch(credentials, "/cache", {
      method: "DELETE",
    });
    await readEdgeResponse(response);
    return audited(
      request,
      "edge.cache.clear",
      new NextResponse(null, { status: 204 }),
      response.status,
    );
  } catch (error) {
    return audited(
      request,
      "edge.cache.clear",
      edgeErrorResponse(error),
      upstreamStatusOf(error),
    );
  }
}
