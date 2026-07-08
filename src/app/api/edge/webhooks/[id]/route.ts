import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  missingCredentialsResponse,
  edgeErrorResponse,
  jsonError,
} from "@/src/lib/edge/request";
import type { Webhook, WebhookInput } from "@/src/types/edge";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const credentials = readCredentials(request);
  if (!credentials) {
    return missingCredentialsResponse();
  }

  const { id } = await context.params;

  try {
    const response = await edgeFetch(
      credentials,
      `/webhooks/${encodeURIComponent(id)}`,
      { method: "GET" },
    );
    const webhook = await readEdgeResponse<Webhook>(response);
    return NextResponse.json(webhook);
  } catch (error) {
    return edgeErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const credentials = readCredentials(request);
  if (!credentials) {
    return missingCredentialsResponse();
  }

  const { id } = await context.params;

  let input: WebhookInput;
  try {
    input = (await request.json()) as WebhookInput;
  } catch {
    return jsonError("validation", 400, { detail: "Invalid JSON body" });
  }

  if (!input.uri || !input.uri.startsWith("https://")) {
    return jsonError("validation", 400, {
      field: "uri",
      detail: "Webhook URI must use HTTPS",
    });
  }

  try {
    const response = await edgeFetch(
      credentials,
      `/webhooks/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
    const webhook = await readEdgeResponse<Webhook>(response);
    return NextResponse.json(webhook);
  } catch (error) {
    return edgeErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const credentials = readCredentials(request);
  if (!credentials) {
    return missingCredentialsResponse();
  }

  const { id } = await context.params;

  try {
    const response = await edgeFetch(
      credentials,
      `/webhooks/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    await readEdgeResponse(response);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return edgeErrorResponse(error);
  }
}
