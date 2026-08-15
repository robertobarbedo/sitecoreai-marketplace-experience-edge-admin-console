import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  edgeErrorResponse,
} from "@/src/lib/edge/request";

/** Removes ALL environment data from Experience Edge. Destructive. */
export async function DELETE(request: Request) {
  const auth = readCredentials(request);
  if (!auth.ok) {
    return auth.response;
  }
  const credentials = auth.credentials;

  try {
    const response = await edgeFetch(credentials, "/content", {
      method: "DELETE",
    });
    await readEdgeResponse(response);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return edgeErrorResponse(error);
  }
}
