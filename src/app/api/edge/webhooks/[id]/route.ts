import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  edgeErrorResponse,
  jsonError,
} from "@/src/lib/edge/request";
import { audited, upstreamStatusOf } from "@/src/app/api/edge/audit";
import type { Webhook, WebhookInput } from "@/src/types/edge";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await readCredentials(request);
  if (!auth.ok) {
    return auth.response;
  }
  const credentials = auth.credentials;

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
  const auth = await readCredentials(request);
  if (!auth.ok) {
    return audited(request, "edge.webhook.update", auth.response);
  }
  const credentials = auth.credentials;

  const { id } = await context.params;

  let input: WebhookInput;
  try {
    input = (await request.json()) as WebhookInput;
  } catch {
    return audited(
      request,
      "edge.webhook.update",
      jsonError("validation", 400, { detail: "Invalid JSON body" }),
    );
  }

  if (!input.uri || !input.uri.startsWith("https://")) {
    return audited(
      request,
      "edge.webhook.update",
      jsonError("validation", 400, {
        field: "uri",
        detail: "Webhook URI must use HTTPS",
      }),
    );
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
    return audited(
      request,
      "edge.webhook.update",
      NextResponse.json(webhook),
      response.status,
    );
  } catch (error) {
    return audited(
      request,
      "edge.webhook.update",
      edgeErrorResponse(error),
      upstreamStatusOf(error),
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await readCredentials(request);
  if (!auth.ok) {
    return audited(request, "edge.webhook.delete", auth.response);
  }
  const credentials = auth.credentials;

  const { id } = await context.params;

  try {
    const response = await edgeFetch(
      credentials,
      `/webhooks/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    await readEdgeResponse(response);
    return audited(
      request,
      "edge.webhook.delete",
      new NextResponse(null, { status: 204 }),
      response.status,
    );
  } catch (error) {
    return audited(
      request,
      "edge.webhook.delete",
      edgeErrorResponse(error),
      upstreamStatusOf(error),
    );
  }
}
