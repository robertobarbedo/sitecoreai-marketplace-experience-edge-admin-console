import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  edgeErrorResponse,
  jsonError,
} from "@/src/lib/edge/request";
import type { EdgeSettings } from "@/src/types/edge";

export async function GET(request: Request) {
  const auth = readCredentials(request);
  if (!auth.ok) {
    return auth.response;
  }
  const credentials = auth.credentials;

  try {
    const response = await edgeFetch(credentials, "/settings", {
      method: "GET",
    });
    const settings = await readEdgeResponse<EdgeSettings>(response);
    return NextResponse.json(settings ?? {});
  } catch (error) {
    return edgeErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const auth = readCredentials(request);
  if (!auth.ok) {
    return auth.response;
  }
  const credentials = auth.credentials;

  let settings: EdgeSettings;
  try {
    settings = (await request.json()) as EdgeSettings;
  } catch {
    return jsonError("validation", 400, { detail: "Invalid JSON body" });
  }

  try {
    const response = await edgeFetch(credentials, "/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
    const updated = await readEdgeResponse<EdgeSettings>(response);
    return NextResponse.json(updated ?? {});
  } catch (error) {
    return edgeErrorResponse(error);
  }
}
