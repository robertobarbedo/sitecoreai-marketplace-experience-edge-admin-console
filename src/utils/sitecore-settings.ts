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

export async function loadEdgeCredentials(
  client: ClientSDK,
  sitecoreContextId: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<EdgeCredentials> {
  try {
    const settingsItem = await queryItemByPath(
      client,
      sitecoreContextId,
      SETTINGS_PATHS.SETTINGS_ITEM,
      language,
    );

    if (settingsItem?.fields?.nodes) {
      const valueField = settingsItem.fields.nodes.find(
        (f) => f.name === "Value",
      );
      if (valueField?.value) {
        try {
          // Merge with defaults so newly added fields always have a fallback value
          return { ...DEFAULT_CREDENTIALS, ...JSON.parse(valueField.value) };
        } catch {
          return { ...DEFAULT_CREDENTIALS };
        }
      }
    }

    return { ...DEFAULT_CREDENTIALS };
  } catch (error) {
    console.error("Error loading Edge credentials:", error);
    return { ...DEFAULT_CREDENTIALS };
  }
}

export async function saveEdgeCredentials(
  client: ClientSDK,
  sitecoreContextId: string,
  credentials: Pick<EdgeCredentials, "clientId" | "clientSecret">,
  language: Language = DEFAULT_LANGUAGE,
): Promise<void> {
  // 1. Ensure the module folder exists
  let moduleFolder = await queryItemByPath(
    client,
    sitecoreContextId,
    SETTINGS_PATHS.MODULE_FOLDER,
    language,
  );

  if (!moduleFolder) {
    moduleFolder = await createItem(
      client,
      sitecoreContextId,
      MODULES_PARENT_ID,
      SITECORE_TEMPLATES.MODULE_FOLDER,
      MODULE_FOLDER_NAME,
      language,
    );

    if (!moduleFolder) {
      throw new Error("Failed to create ExperienceEdgeConsole folder");
    }
  }

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
