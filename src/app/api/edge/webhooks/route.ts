import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  missingCredentialsResponse,
  edgeErrorResponse,
  jsonError,
} from "@/src/lib/edge/request";
import type { Webhook, WebhookInput } from "@/src/types/edge";

export async function GET(request: Request) {
  const credentials = readCredentials(request);
  if (!credentials) {
    return missingCredentialsResponse();
  }

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
  const credentials = readCredentials(request);
  if (!credentials) {
    return missingCredentialsResponse();
  }

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
    const response = await edgeFetch(credentials, "/webhooks", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const webhook = await readEdgeResponse<Webhook>(response);
    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    return edgeErrorResponse(error);
  }
}
