import { BlockedUrlError, parseSafeUrl, safeRequest } from "@/src/utils/ssrfGuard";

/**
 * Server-side HTTPS request to a URL the server does not control (a
 * webhook's endpoint), through the shared SSRF guard (src/utils/ssrfGuard.ts):
 *
 * - https on port 443 only, no credentials, no IP-literal hosts;
 * - only public unicast addresses (allowlist), checked inside the socket's
 *   own DNS lookup — the connection goes to exactly the address that was
 *   checked, so DNS rebinding can't swap in an internal one;
 * - redirects are never followed (a 3xx is returned as the result);
 * - a timeout and a cap on the response body read.
 */

export { BlockedUrlError };

/** Throws BlockedUrlError unless `raw` is an https URL this server may call. */
export function parsePublicHttpsUrl(raw: string): URL {
  return parseSafeUrl(raw, { httpsOnly: true });
}

export interface PublicHttpsResponse {
  status: number;
  statusText: string;
  body: string;
  truncated: boolean;
}

/**
 * Sends one request (see the module comment for the guards). Rejects with
 * BlockedUrlError for a disallowed target, a TimeoutError on timeout, or the
 * network error for anything else.
 */
export async function publicHttpsRequest(
  raw: string,
  init: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs: number;
    maxResponseChars: number;
  },
): Promise<PublicHttpsResponse> {
  const { response, truncated } = await safeRequest(raw, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    timeoutMs: init.timeoutMs,
    // UTF-8 is at most 4 bytes per char; trim to the char limit below
    maxBodyBytes: init.maxResponseChars * 4,
    maxRedirects: 0,
    httpsOnly: true,
  });
  const text = await response.text();
  return {
    status: response.status,
    statusText: response.statusText,
    body: text.slice(0, init.maxResponseChars),
    truncated: truncated || text.length > init.maxResponseChars,
  };
}
