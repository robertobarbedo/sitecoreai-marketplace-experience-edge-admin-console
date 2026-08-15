import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import {
  queryItemByPath,
  createItem,
  updateItemFieldByPath,
} from "./sitecore-graphql";
import {
  SITECORE_TEMPLATES,
  MODULES_PARENT_ID,
  SETTINGS_PATHS,
  LEGACY_SETTINGS_ITEM_PATH,
  MARKETPLACE_FOLDER_NAME,
  MODULE_FOLDER_NAME,
  SETTINGS_ITEM_NAME,
  DEFAULT_LANGUAGE,
  type Language,
} from "@/src/constants";

/** Current storage format: the client secret is persisted sealed, never in plaintext. */
export const CREDENTIALS_VERSION = 2;

export interface EdgeCredentials {
  version: number;
  clientId: string;
  /**
   * AES-GCM sealed client secret, as produced by the server (`v1.…`). It is
   * opaque to the browser: it can be sent back to the app's own API routes,
   * but it can never be turned back into the secret here.
   */
  secretCipher: string;
  updatedAt: string;
  /**
   * Plaintext secret read from a pre-encryption (version 1) settings item.
   * Only ever set while a migration to `secretCipher` is pending.
   */
  legacySecret?: string;
}

const DEFAULT_CREDENTIALS: EdgeCredentials = {
  version: CREDENTIALS_VERSION,
  clientId: "",
  secretCipher: "",
  updatedAt: "",
};

export function hasCredentials(credentials: EdgeCredentials): boolean {
  return Boolean(
    credentials.clientId && (credentials.secretCipher || credentials.legacySecret),
  );
}

/** True while a version 1 item still holds the secret in plaintext. */
export function needsSecretMigration(credentials: EdgeCredentials): boolean {
  return Boolean(credentials.legacySecret && !credentials.secretCipher);
}

/** The secret value to send to the API routes — sealed when available. */
export function apiSecret(credentials: EdgeCredentials): string {
  return credentials.secretCipher || credentials.legacySecret || "";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Normalizes a stored payload of either version into the current shape. */
function parseCredentials(raw: string): EdgeCredentials | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const secretCipher = asString(parsed.secretCipher);
  // Version 1 stored the secret in the clear under `clientSecret`.
  const legacySecret = asString(parsed.clientSecret);

  return {
    version: secretCipher ? CREDENTIALS_VERSION : 1,
    clientId: asString(parsed.clientId),
    secretCipher,
    updatedAt: asString(parsed.updatedAt),
    ...(secretCipher ? {} : legacySecret ? { legacySecret } : {}),
  };
}

/** Reads and parses the credentials item at `path`; null if absent/unparsable. */
async function readCredentialsItem(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  language: Language,
): Promise<EdgeCredentials | null> {
  const settingsItem = await queryItemByPath(
    client,
    sitecoreContextId,
    path,
    language,
  );

  const valueField = settingsItem?.fields?.nodes?.find(
    (f) => f.name === "Value",
  );
  if (!valueField?.value) return null;

  return parseCredentials(valueField.value);
}

export async function loadEdgeCredentials(
  client: ClientSDK,
  sitecoreContextId: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<EdgeCredentials> {
  try {
    // Settings moved under /sitecore/system/Modules/Marketplace; fall back to
    // the legacy location so existing installs keep their credentials. The
    // next save writes to the new path.
    return (
      (await readCredentialsItem(
        client,
        sitecoreContextId,
        SETTINGS_PATHS.SETTINGS_ITEM,
        language,
      )) ??
      (await readCredentialsItem(
        client,
        sitecoreContextId,
        LEGACY_SETTINGS_ITEM_PATH,
        language,
      )) ?? { ...DEFAULT_CREDENTIALS }
    );
  } catch (error) {
    console.error("Error loading Edge credentials:", error);
    return { ...DEFAULT_CREDENTIALS };
  }
}

/** Ensures a folder item exists, creating it under `parentId` if missing. */
async function ensureFolder(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  parentId: string,
  name: string,
  language: Language,
) {
  const existing = await queryItemByPath(
    client,
    sitecoreContextId,
    path,
    language,
  );
  if (existing) return existing;

  const created = await createItem(
    client,
    sitecoreContextId,
    parentId,
    SITECORE_TEMPLATES.MODULE_FOLDER,
    name,
    language,
  );
  if (!created) {
    throw new Error(`Failed to create ${name} folder`);
  }
  return created;
}

/**
 * Persists the credentials. `secretCipher` must already be sealed by the
 * server (`POST /api/edge/validate`) — this function never sees, and the
 * content tree never holds, the plaintext secret. Writing the whole `Value`
 * field also erases any plaintext left by a version 1 install.
 */
export async function saveEdgeCredentials(
  client: ClientSDK,
  sitecoreContextId: string,
  credentials: Pick<EdgeCredentials, "clientId" | "secretCipher">,
  language: Language = DEFAULT_LANGUAGE,
): Promise<void> {
  // 1. Ensure /sitecore/system/Modules/Marketplace/ExperienceEdgeAdminConsole
  const marketplaceFolder = await ensureFolder(
    client,
    sitecoreContextId,
    SETTINGS_PATHS.MARKETPLACE_FOLDER,
    MODULES_PARENT_ID,
    MARKETPLACE_FOLDER_NAME,
    language,
  );
  const moduleFolder = await ensureFolder(
    client,
    sitecoreContextId,
    SETTINGS_PATHS.MODULE_FOLDER,
    marketplaceFolder.itemId,
    MODULE_FOLDER_NAME,
    language,
  );

  // 2. Ensure the Settings item exists
  let settingsItem = await queryItemByPath(
    client,
    sitecoreContextId,
    SETTINGS_PATHS.SETTINGS_ITEM,
    language,
  );

  if (!settingsItem) {
    settingsItem = await createItem(
      client,
      sitecoreContextId,
      moduleFolder.itemId,
      SITECORE_TEMPLATES.SETTINGS_ITEM,
      SETTINGS_ITEM_NAME,
      language,
    );

    if (!settingsItem) {
      throw new Error("Failed to create Settings item");
    }
  }

  // 3. Update the Value field with the credentials JSON
  const value: EdgeCredentials = {
    version: CREDENTIALS_VERSION,
    clientId: credentials.clientId,
    secretCipher: credentials.secretCipher,
    updatedAt: new Date().toISOString(),
  };

  await updateItemFieldByPath(
    client,
    sitecoreContextId,
    SETTINGS_PATHS.SETTINGS_ITEM,
    "Value",
    JSON.stringify(value),
    language,
  );
}
