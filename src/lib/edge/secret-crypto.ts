import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

/**
 * Server-side sealing of the Edge admin Client Secret.
 *
 * The secret is only ever handled in plaintext here, on the server, at the
 * moment the user first enters it (and right before each token exchange).
 * Everything that leaves this module — the value stored in the Sitecore
 * content tree, the value held by the browser,
 * the `x-edge-client-secret` header on subsequent calls — is AES-256-GCM
 * ciphertext that can only be opened with the deployment's encryption key.
 *
 * The key comes from EDGE_SECRET_ENCRYPTION_KEY (any passphrase of 16+
 * characters; a 32-byte AES key is derived from it with HKDF-SHA256). It is
 * never optional: without it the app refuses to store credentials rather than
 * silently falling back to plaintext.
 */

const KEY_ENV = "EDGE_SECRET_ENCRYPTION_KEY";
const MIN_KEY_LENGTH = 16;

/**
 * Format marker; bump if the wire format ever changes. v3 binds the secret to
 * the Sitecore Cloud organization of the signed-in user and to its client ID
 * (GCM additional authenticated data), so a sealed secret only opens for a
 * caller of the same organization, next to the client ID it was sealed for.
 * Earlier formats (v1 unbound, v2 bound to the client ID only) are no longer
 * opened at all: migrating them would let anyone holding a copy re-seal it
 * for their own organization, so the user enters the secret again instead.
 */
const SEAL_VERSION = "v3";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const HKDF_SALT = "sitecoreai-marketplace-experience-edge-console";
const HKDF_INFO = "edge-admin-client-secret";

/** The deployment has no (usable) EDGE_SECRET_ENCRYPTION_KEY. */
export class EncryptionUnavailableError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "EncryptionUnavailableError";
  }
}

/** A sealed secret could not be opened — malformed, tampered with, or sealed under a different key. */
export class SecretSealError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "SecretSealError";
  }
}

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const passphrase = process.env[KEY_ENV]?.trim();
  if (!passphrase) {
    throw new EncryptionUnavailableError(
      `${KEY_ENV} is not set on the server, so client secrets cannot be encrypted.`,
    );
  }
  if (passphrase.length < MIN_KEY_LENGTH) {
    throw new EncryptionUnavailableError(
      `${KEY_ENV} must be at least ${MIN_KEY_LENGTH} characters.`,
    );
  }

  cachedKey = Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(passphrase, "utf8"),
      Buffer.from(HKDF_SALT, "utf8"),
      Buffer.from(HKDF_INFO, "utf8"),
      KEY_BYTES,
    ),
  );
  return cachedKey;
}

/** True when the server is configured to seal secrets. */
export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/** True for values produced by {@link sealSecret}. */
export function isSealed(value: string): boolean {
  return value.startsWith(`${SEAL_VERSION}.`);
}

/** Identifies who a sealed secret belongs to. */
export interface SecretBinding {
  /** Verified `org_id` claim of the caller's Sitecore Cloud access token. */
  organizationId: string;
  clientId: string;
}

function bindingData({ organizationId, clientId }: SecretBinding): Buffer {
  // JSON keeps the two values unambiguous whatever characters they contain.
  return Buffer.from(JSON.stringify(["org", organizationId, "client", clientId]), "utf8");
}

/** Encrypts a plaintext secret for one organization and client ID into a self-describing, storable string. */
export function sealSecret(plaintext: string, binding: SecretBinding): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(bindingData(binding));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    SEAL_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Decrypts a value produced by {@link sealSecret} for the same organization
 * and client ID. Plaintext and older formats are rejected — only the validate
 * route accepts plaintext, to seal it.
 */
export function openSecret(sealed: string, binding: SecretBinding): string {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== SEAL_VERSION) {
    throw new SecretSealError(
      "The stored client secret is in an older or unreadable format. Re-enter the credentials in Settings.",
    );
  }

  const [, iv, tag, ciphertext] = parts;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAAD(bindingData(binding));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof EncryptionUnavailableError) {
      throw error;
    }
    // Wrong key, another organization or client ID, or a tampered payload —
    // indistinguishable, and all mean the user has to enter the secret again.
    throw new SecretSealError(
      "The stored client secret could not be decrypted. It was sealed with a different encryption key, for another organization or for a different Client ID; re-enter the credentials.",
    );
  }
}

/**
 * For the validate route: takes a secret the user just typed (plaintext) or a
 * current sealed value of the same organization and client ID, and returns
 * the plaintext (for the token exchange) plus the sealed form (the only form
 * that is ever returned to the browser). Older sealed formats are rejected.
 */
export function sealForClient(
  value: string,
  binding: SecretBinding,
): { plaintext: string; sealed: string } {
  if (isSealed(value)) {
    return { plaintext: openSecret(value, binding), sealed: value };
  }
  if (/^v[12]\.[\w-]+\.[\w-]+\.[\w-]+$/.test(value)) {
    // v1/v2 ciphertext is never re-sealed, see SEAL_VERSION.
    throw new SecretSealError(
      "The stored client secret was encrypted by an older version of the app. Re-enter the credentials in Settings.",
    );
  }
  return { plaintext: value, sealed: sealSecret(value, binding) };
}
