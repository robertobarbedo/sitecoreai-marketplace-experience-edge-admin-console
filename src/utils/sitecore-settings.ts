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

export interface EdgeCredentials {
  version: number;
  clientId: string;
  clientSecret: string;
  updatedAt: string;
}

const DEFAULT_CREDENTIALS: EdgeCredentials = {
  version: 1,
  clientId: "",
  clientSecret: "",
  updatedAt: "",
};

export function hasCredentials(credentials: EdgeCredentials): boolean {
  return Boolean(credentials.clientId && credentials.clientSecret);
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

  try {
    // Merge with defaults so newly added fields always have a fallback value
    return { ...DEFAULT_CREDENTIALS, ...JSON.parse(valueField.value) };
  } catch {
    return null;
  }
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

export async function saveEdgeCredentials(
  client: ClientSDK,
  sitecoreContextId: string,
  credentials: Pick<EdgeCredentials, "clientId" | "clientSecret">,
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
    version: 1,
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
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
