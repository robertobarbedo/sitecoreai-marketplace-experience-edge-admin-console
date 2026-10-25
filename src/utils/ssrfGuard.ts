/**
 * SSRF guard for server-side requests to URLs the server does not control.
 *
 * Shared file — kept identical across the Marketplace apps that need it.
 *
 * - Allowlist, not denylist: an address is allowed only when ipaddr.js
 *   classifies it as plain "unicast". Loopback, private, link-local, CGNAT,
 *   multicast, reserved, documentation, and every IPv6 range that embeds an
 *   IPv4 address (IPv4-mapped, NAT64, 6to4, Teredo, ...) are refused.
 * - The check runs inside the socket's own DNS lookup, so the connection goes
 *   to exactly the address that was checked (no DNS-rebinding window).
 * - IP-literal hosts are refused outright: real targets have host names.
 * - http(s) on the default ports only, no credentials in the URL.
 * - Redirects are followed by hand (or not at all); every hop goes through
 *   the same checks. Caller headers never leave the original origin.
 * - One timeout for the whole exchange and a cap on the body read.
 */

import ipaddr from "ipaddr.js";
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

/** The URL or the address it resolves to is not allowed. */
export class BlockedUrlError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "BlockedUrlError";
  }
}

const BLOCKED_ADDRESS = "The URL resolves to a private or reserved address";

// The only IPv6 block allocated for global unicast. ipaddr.js still calls
// deprecated forms like ::7f00:1 (IPv4-compatible) or fec0::/10 "unicast".
const IPV6_GLOBAL_UNICAST = ipaddr.parseCIDR("2000::/3");

/** True only for a canonical IP address in public unicast space. */
export function isPublicAddress(ip: string): boolean {
  if (isIP(ip) === 0 || !ipaddr.isValid(ip)) return false;
  // process() turns IPv4-mapped IPv6 (::ffff:a.b.c.d, any spelling) into IPv4
  const address = ipaddr.process(ip);
  if (address.range() !== "unicast") return false;
  return address.kind() === "ipv4" || address.match(IPV6_GLOBAL_UNICAST);
}

export function isPrivateAddress(ip: string): boolean {
  return !isPublicAddress(ip);
}

/** Throws BlockedUrlError unless `raw` is a URL this server may call. */
export function parseSafeUrl(raw: string, { httpsOnly = false } = {}): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("Invalid URL");
  }
  const allowed = httpsOnly ? ["https:"] : ["http:", "https:"];
  if (!allowed.includes(url.protocol)) {
    throw new BlockedUrlError(httpsOnly ? "Only https URLs are allowed" : "Only http and https URLs are allowed");
  }
  if (url.username || url.password) {
    throw new BlockedUrlError("URLs with credentials are not allowed");
  }
  // URL drops the port when it is the scheme's default, so "" is the only safe value
  if (url.port !== "") {
    throw new BlockedUrlError("Only the default ports (80/443) are allowed");
  }
  if (isIP(url.hostname.replace(/^\[|\]$/g, "")) !== 0) {
    throw new BlockedUrlError("IP addresses are not allowed; use a host name");
  }
  return url;
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/** dns.lookup that refuses to hand a non-public address to the socket. */
export function publicOnlyLookup(
  hostname: string,
  options: LookupOptions,
  callback: LookupCallback,
): void {
  dnsLookup(hostname, { ...options, all: true, verbatim: true }, (error, addresses) => {
    if (error) {
      callback(error, "");
      return;
    }
    if (addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address))) {
      callback(new BlockedUrlError(BLOCKED_ADDRESS), "");
      return;
    }
    if (options.all) {
      callback(null, addresses);
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  });
}

/** Hop-by-hop / framing headers a caller must not set. */
const STRIPPED_HEADERS = new Set([
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "te",
  "trailer",
  "upgrade",
  "expect",
  "proxy-authorization",
  "proxy-connection",
]);

function withoutStrippedHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!STRIPPED_HEADERS.has(name.toLowerCase())) kept[name] = value;
  }
  return kept;
}

export interface SafeRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  /** Sent only while the request stays on the original URL's origin. */
  originHeaders?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  maxBodyBytes: number;
  /** 0 = return 3xx responses as-is. */
  maxRedirects?: number;
  httpsOnly?: boolean;
  /** Skip reading the body (header-only checks). */
  skipBody?: boolean;
}

export interface SafeRequestResult {
  response: Response;
  /** The body was cut at maxBodyBytes. */
  truncated: boolean;
  /** The URL that produced the final response. */
  url: URL;
}

const NULL_BODY_STATUSES = new Set([204, 205, 304]);

function sendOnce(
  url: URL,
  method: string,
  requestBody: string | undefined,
  headers: Record<string, string>,
  maxBodyBytes: number,
  signal: AbortSignal,
  readBody: boolean,
): Promise<{ message: IncomingMessage; body: Buffer; truncated: boolean }> {
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  const outgoing: Record<string, string> = { ...headers };
  if (requestBody !== undefined) {
    outgoing["Content-Length"] = String(Buffer.byteLength(requestBody));
  }

  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method,
        headers: outgoing,
        lookup: publicOnlyLookup,
        agent: false, // fresh socket every time; never reuse one connected elsewhere
        signal,
      },
      (message) => {
        if (!readBody) {
          message.destroy();
          resolve({ message, body: Buffer.alloc(0), truncated: false });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        message.on("data", (chunk: Buffer) => {
          if (truncated) return;
          const room = maxBodyBytes - size;
          if (chunk.length >= room) {
            chunks.push(chunk.subarray(0, room));
            size += room;
            // Stopped at the cap before the end: treat as truncated even on an exact fill
            truncated = true;
            message.destroy();
            resolve({ message, body: Buffer.concat(chunks), truncated });
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        message.on("end", () => resolve({ message, body: Buffer.concat(chunks), truncated }));
        message.on("error", (error) => (truncated ? undefined : reject(error)));
      },
    );
    req.on("error", (error) => {
      // AbortSignal.timeout aborts with a TimeoutError reason; surface it as such
      const reason = (error as { cause?: unknown }).cause;
      reject(reason instanceof Error && reason.name === "TimeoutError" ? reason : error);
    });
    req.end(requestBody);
  });
}

function toHeaders(message: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(message.headers)) {
    if (value === undefined) continue;
    try {
      headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    } catch {
      // drop header values the Fetch API refuses
    }
  }
  return headers;
}

/**
 * Sends a request to a user-supplied URL under the guards above. Rejects with
 * BlockedUrlError for a disallowed target, a TimeoutError on timeout, or the
 * network error for anything else.
 */
export async function safeRequest(raw: string, options: SafeRequestOptions): Promise<SafeRequestResult> {
  const signal = AbortSignal.timeout(options.timeoutMs);
  const maxRedirects = options.maxRedirects ?? 0;
  const baseHeaders = withoutStrippedHeaders(options.headers);
  const originHeaders = withoutStrippedHeaders(options.originHeaders);

  let url = parseSafeUrl(raw, { httpsOnly: options.httpsOnly });
  const origin = url.origin;
  let method = (options.method ?? "GET").toUpperCase();
  let requestBody = options.body;

  for (let hop = 0; ; hop++) {
    const headers = url.origin === origin ? { ...baseHeaders, ...originHeaders } : baseHeaders;
    const { message, body, truncated } = await sendOnce(
      url,
      method,
      requestBody,
      headers,
      options.maxBodyBytes,
      signal,
      !options.skipBody,
    );
    const code = message.statusCode ?? 0;
    const next = message.headers.location;

    if (maxRedirects > 0 && code >= 300 && code < 400 && next) {
      if (hop >= maxRedirects) throw new BlockedUrlError("Too many redirects");
      const target = parseSafeUrl(new URL(next, url).toString(), { httpsOnly: options.httpsOnly });
      if (url.protocol === "https:" && target.protocol !== "https:") {
        throw new BlockedUrlError("Redirect from https to http is not allowed");
      }
      if (code === 301 || code === 302 || code === 303) {
        // Browsers' behaviour: the follow-up is a GET without the original body
        if (method !== "HEAD") method = "GET";
        requestBody = undefined;
      } else if (requestBody !== undefined && target.origin !== origin) {
        // 307/308 would replay the body; never send it to another origin
        throw new BlockedUrlError("Redirect to another origin with a request body is not allowed");
      }
      url = target;
      continue;
    }

    if (code < 200 || code > 599) {
      throw new Error(`Unexpected upstream status ${code}`);
    }
    const response = new Response(NULL_BODY_STATUSES.has(code) ? null : new Uint8Array(body), {
      status: code,
      statusText: message.statusMessage ?? "",
      headers: toHeaders(message),
    });
    return { response, truncated, url };
  }
}

/** A message for the browser that names our own refusals but no network internals. */
export function describeRequestError(error: unknown): string {
  if (error instanceof BlockedUrlError) return error.message;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "The site did not respond in time";
  }
  return "Could not reach the URL";
}
