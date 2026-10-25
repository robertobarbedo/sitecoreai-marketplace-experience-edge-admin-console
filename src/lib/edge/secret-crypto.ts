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
 * Format marker; bump if the wire format ever changes. v2 binds the secret to
 * its client ID (GCM additional authenticated data), so a sealed secret only
 * opens next to the client ID it was sealed for.
 */
const SEAL_VERSION = "v2";
/** Unbound format written before 2026-10-24; only opened to migrate it. */
const LEGACY_SEAL_VERSION = "v1";
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

function bindingData(clientId: string): Buffer {
  return Buffer.from(clientId, "utf8");
}

/** Encrypts a plaintext secret for one client ID into a self-describing, storable string. */
export function sealSecret(plaintext: string, clientId: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(bindingData(clientId));
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

function openParts(sealed: string, version: string, aad: Buffer | null): string {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== version) {
    throw new SecretSealError("The stored client secret is not in a readable format.");
  }

  const [, iv, tag, ciphertext] = parts;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(iv, "base64url"),
    );
    if (aad) decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof EncryptionUnavailableError) {
      throw error;
    }
    // Wrong key, another client ID or a tampered payload — indistinguishable,
    // and all mean the user has to enter the secret again.
    throw new SecretSealError(
      "The stored client secret could not be decrypted. It was sealed with a different encryption key or for a different Client ID; re-enter the credentials.",
    );
  }
}

/**
 * Decrypts a value produced by {@link sealSecret} for `clientId`. Plaintext
 * and the unbound v1 format are rejected — only the validate route accepts
 * them, to seal them.
 */
export function openSecret(sealed: string, clientId: string): string {
  return openParts(sealed, SEAL_VERSION, bindingData(clientId));
}

/**
 * For the validate route: takes a secret the user just typed (plaintext), a
 * stored unbound v1 value being migrated, or a current v2 value, and returns
 * the plaintext (for the token exchange) plus the v2 form bound to
 * `clientId` (the only form that is ever returned to the browser).
 */
export function sealForClient(
  value: string,
  clientId: string,
): { plaintext: string; sealed: string } {
  if (isSealed(value)) {
    return { plaintext: openSecret(value, clientId), sealed: value };
  }
  const plaintext = value.startsWith(`${LEGACY_SEAL_VERSION}.`)
    ? openParts(value, LEGACY_SEAL_VERSION, null)
    : value;
  return { plaintext, sealed: sealSecret(plaintext, clientId) };
}
