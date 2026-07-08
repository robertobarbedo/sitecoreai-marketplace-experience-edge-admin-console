import { getToken, evictToken, InvalidCredentialsError } from "./auth";

const ADMIN_API_BASE = "https://edge.sitecorecloud.io/api/admin/v1";

export interface EdgeCredentialPair {
  clientId: string;
  clientSecret: string;
}

export class EdgeApiRequestError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`Edge Admin API error (${status}): ${detail}`);
    this.name = "EdgeApiRequestError";
  }
}

export class UpstreamUnreachableError extends Error {
  constructor(cause?: unknown) {
    super("Could not reach the Experience Edge Admin API");
    this.name = "UpstreamUnreachableError";
    this.cause = cause;
  }
}

export { InvalidCredentialsError };

/**
 * Calls the Experience Edge Admin API with a token obtained from the
 * credential pair. On a 401 (e.g. token expired despite the cache margin)
 * the cached token is evicted and the request retried once.
 */
export async function edgeFetch(
  credentials: EdgeCredentialPair,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const attempt = async (): Promise<Response> => {
    const token = await getToken(credentials.clientId, credentials.clientSecret);
    try {
      return await fetch(`${ADMIN_API_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      throw new UpstreamUnreachableError(error);
    }
  };

  let response = await attempt();

  if (response.status === 401) {
    evictToken(credentials.clientId, credentials.clientSecret);
    response = await attempt();
    if (response.status === 401) {
      const detail = await response.text().catch(() => "");
      throw new InvalidCredentialsError(detail);
    }
  }

  return response;
}

/**
 * Reads the upstream response and throws a typed error for non-2xx statuses.
 * Returns the parsed JSON body, or null for empty (204) responses.
 */
export async function readEdgeResponse<T>(response: Response): Promise<T | null> {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new EdgeApiRequestError(response.status, detail);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text) as T;
}
