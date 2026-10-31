import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  edgeErrorResponse,
  jsonError,
} from "@/src/lib/edge/request";
import { audited, upstreamStatusOf } from "@/src/app/api/edge/audit";
import type { Webhook, WebhookInput } from "@/src/types/edge";

export async function GET(request: Request) {
  const auth = await readCredentials(request);
  if (!auth.ok) {
    return auth.response;
  }
  const credentials = auth.credentials;

  try {
    const response = await edgeFetch(credentials, "/webhooks", {
      method: "GET",
    });
    const webhooks = await readEdgeResponse<Webhook[]>(response);
    return NextResponse.json(webhooks ?? []);
  } catch (error) {
    return edgeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await readCredentials(request);
  if (!auth.ok) {
    return audited(request, "edge.webhook.create", auth.response);
  }
  const credentials = auth.credentials;

  let input: WebhookInput;
  try {
    input = (await request.json()) as WebhookInput;
  } catch {
    return audited(
      request,
      "edge.webhook.create",
      jsonError("validation", 400, { detail: "Invalid JSON body" }),
    );
  }

  if (!input.uri || !input.uri.startsWith("https://")) {
    return audited(
      request,
      "edge.webhook.create",
      jsonError("validation", 400, {
        field: "uri",
        detail: "Webhook URI must use HTTPS",
      }),
    );
  }

  try {
    const response = await edgeFetch(credentials, "/webhooks", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const webhook = await readEdgeResponse<Webhook>(response);
    return audited(
      request,
      "edge.webhook.create",
      NextResponse.json(webhook, { status: 201 }),
      response.status,
    );
  } catch (error) {
    return audited(
      request,
      "edge.webhook.create",
      edgeErrorResponse(error),
      upstreamStatusOf(error),
    );
  }
}
