import { decodeJwt } from "jose";
import {
  EdgeApiRequestError,
  InvalidCredentialsError,
} from "@/src/lib/edge/admin-client";
import {
  auditLog,
  type AuditOutcome,
} from "@/src/lib/marketplace-auth/audit-log";

/**
 * Audit lines for the sensitive Edge operations (secret sealing, cache and
 * content purges, settings and webhook changes). Only the event name, the
 * outcome and the statuses are logged — never credentials, tokens, webhook
 * definitions or settings payloads.
 */

/**
 * The caller's subject and organization, read from the bearer token. The
 * middleware (and readCredentials) has already verified it; this only labels
 * the audit line.
 */
function readCaller(request: Request): { sub?: string; org?: string | null } {
  const match = (request.headers.get("authorization") ?? "").match(
    /^Bearer\s+(.+)$/i,
  );
  if (!match) return {};
  try {
    const claims = decodeJwt(match[1]);
    const org = claims.org_id;
    return {
      sub: typeof claims.sub === "string" ? claims.sub : undefined,
      org: typeof org === "string" ? org : null,
    };
  } catch {
    return {};
  }
}

function outcomeFor(status: number): AuditOutcome {
  if (status < 400) return "allow";
  if (status < 500) return "deny";
  return "error";
}

/** The Experience Edge status behind a thrown edgeFetch/readEdgeResponse error, if any. */
export function upstreamStatusOf(error: unknown): number | undefined {
  if (error instanceof EdgeApiRequestError) return error.status;
  if (error instanceof InvalidCredentialsError) return 401;
  return undefined;
}

/**
 * Writes one audit line for `response` and returns it unchanged, so a
 * handler can wrap every return: `return audited(request, "edge.cache.clear", res)`.
 */
export function audited<T extends Response>(
  request: Request,
  event: string,
  response: T,
  upstreamStatus?: number,
): T {
  auditLog(request, {
    event,
    outcome: outcomeFor(response.status),
    status: response.status,
    ...readCaller(request),
    ...(upstreamStatus !== undefined ? { upstreamStatus } : {}),
  });
  return response;
}
