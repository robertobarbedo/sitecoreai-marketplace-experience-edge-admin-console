import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

/**
 * Server-side sealing of the Edge admin Client Secret.
 *
 * The secret is only ever handled in plaintext here, on the server, at the
 * moment the user first enters it. Everything that leaves this module — the
 * value stored in the Sitecore content tree, the value held by the browser,
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

/** Format marker; bump if the wire format ever changes. */
const SEAL_VERSION = "v1";
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

/** Encrypts a plaintext secret into a self-describing, storable string. */
export function sealSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
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

/** Decrypts a value produced by {@link sealSecret}. */
export function openSecret(sealed: string): string {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== SEAL_VERSION) {
    throw new SecretSealError("The stored client secret is not in a readable format.");
  }

  const [, iv, tag, ciphertext] = parts;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof EncryptionUnavailableError) {
      throw error;
    }
    // Wrong key or tampered payload — indistinguishable, and both mean the
    // user has to enter the secret again.
    throw new SecretSealError(
      "The stored client secret could not be decrypted. It was most likely sealed with a different encryption key; re-enter the credentials.",
    );
  }
}

/**
 * Returns the plaintext for a secret that may arrive sealed (the normal case)
 * or in plaintext (a direct `curl` against the API routes, or a legacy
 * plaintext value being migrated).
 */
export function resolveSecret(value: string): string {
  return isSealed(value) ? openSecret(value) : value;
}

/** Seals `value` unless it already is sealed. */
export function ensureSealed(value: string): string {
  return isSealed(value) ? value : sealSecret(value);
}
