"use client";

import { useCallback, useEffect, useState } from "react";
import { mdiCog, mdiLoading } from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { ConnectionGate } from "@/components/connection-gate";
import { SettingsModal } from "@/components/settings-modal";
import { WebhooksTab } from "@/components/webhooks/webhooks-tab";
import { CacheTab } from "@/components/cache/cache-tab";
import { EdgeSettingsTab } from "@/components/edge-settings/edge-settings-tab";
import { useMarketplaceClient } from "@/src/utils/hooks/useMarketplaceClient";
import { getSitecoreContextId } from "@/src/utils/sitecore-graphql";
import {
  loadEdgeCredentials,
  saveEdgeCredentials,
  hasCredentials,
  type EdgeCredentials,
} from "@/src/utils/sitecore-settings";
import type { EdgeApiCredentials } from "@/src/utils/hooks/useEdgeApi";

type ToastVariant = "default" | "success" | "error" | "warning";

interface ToastState {
  open: boolean;
  title: string;
  description?: string;
  variant: ToastVariant;
}

export default function FullscreenExtension() {
  const { client, error, isInitialized } = useMarketplaceClient();

  const [contextId, setContextId] = useState<string>("");
  const [credentials, setCredentials] = useState<EdgeCredentials | null>(null);
  const [loadingCredentials, setLoadingCredentials] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    title: "",
    variant: "default",
  });

  const showToast = useCallback(
    (title: string, description?: string, variant: ToastVariant = "default") => {
      setToast({ open: true, title, description, variant });
    },
    [],
  );

  // Once the SDK is up: resolve the context id and load stored credentials
  useEffect(() => {
    if (!isInitialized || !client) return;

    let cancelled = false;
    (async () => {
      try {
        const ctxId = await getSitecoreContextId(client);
        if (cancelled) return;
        setContextId(ctxId);

        const creds = await loadEdgeCredentials(client, ctxId);
        if (cancelled) return;
        setCredentials(creds);
      } catch (err) {
        console.error("Error loading app context/credentials:", err);
        if (!cancelled) {
          showToast(
            "Failed to load settings",
            "Could not read stored credentials from the content tree.",
            "error",
          );
        }
      } finally {
        if (!cancelled) setLoadingCredentials(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isInitialized, client, showToast]);

  const handleSaveCredentials = useCallback(
    async (input: { clientId: string; clientSecret: string }) => {
      if (!client || !contextId) return;
      try {
        await saveEdgeCredentials(client, contextId, input);
        setCredentials({
          version: 1,
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          updatedAt: new Date().toISOString(),
        });
        showToast("Connected", "Credentials saved successfully.", "success");
      } catch (err) {
        console.error("Error saving credentials:", err);
        showToast(
          "Save failed",
          "Could not persist the credentials to the content tree.",
          "error",
        );
        throw err;
      }
    },
    [client, contextId, showToast],
  );

  const handleAuthError = useCallback(() => {
    showToast(
      "Credentials rejected",
      "The Experience Edge API rejected the stored credentials. Update them in Settings.",
      "error",
    );
    setSettingsOpen(true);
  }, [showToast]);

  const apiCredentials: EdgeApiCredentials | null =
    credentials && hasCredentials(credentials)
      ? { clientId: credentials.clientId, clientSecret: credentials.clientSecret }
      : null;

  // ---- Render states ----

  if (error) {
    return (
      <main className="p-(--spacing-margin-page) min-h-screen bg-surface-bright">
        <div className="mx-auto max-w-[1280px]">
          <div className="rounded-xl border border-danger bg-danger-bg p-6 text-danger-fg">
            <h2 className="mb-1 font-bold">Failed to connect to Sitecore</h2>
            <p className="text-sm">
              The Marketplace SDK could not be initialized. Make sure this app is
              opened from inside SitecoreAI. ({error.message})
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!isInitialized || loadingCredentials) {
    return (
      <main className="p-(--spacing-margin-page) min-h-screen bg-surface-bright">
        <div className="mx-auto flex max-w-[1280px] items-center justify-center py-32">
          <div className="flex items-center gap-3 text-text-subtle">
            <Icon path={mdiLoading} size={1} className="animate-spin" />
            <span>Connecting to Sitecore&hellip;</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <ToastProvider swipeDirection="right">
      <main className="p-(--spacing-margin-page) min-h-screen bg-surface-bright">
        <div className="mx-auto max-w-[1280px] space-y-5">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-on-surface">
                Experience Edge Console
              </h1>
              <p className="text-[11px] text-text-subtle">
                Manage webhooks, cache, and settings for this environment&apos;s
                Experience Edge.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open credential settings"
            >
              <Icon path={mdiCog} />
            </Button>
          </header>

          {!apiCredentials ? (
            <ConnectionGate onConfigure={() => setSettingsOpen(true)} />
          ) : (
            <Tabs defaultValue="webhooks">
              <TabsList>
                <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
                <TabsTrigger value="cache">Cache</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="webhooks">
                <WebhooksTab
                  credentials={apiCredentials}
                  showToast={showToast}
                  onAuthError={handleAuthError}
                />
              </TabsContent>
              <TabsContent value="cache">
                <CacheTab
                  credentials={apiCredentials}
                  showToast={showToast}
                  onAuthError={handleAuthError}
                />
              </TabsContent>
              <TabsContent value="settings">
                <EdgeSettingsTab
                  credentials={apiCredentials}
                  showToast={showToast}
                  onAuthError={handleAuthError}
                />
              </TabsContent>
            </Tabs>
          )}

          <SettingsModal
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            initialClientId={credentials?.clientId ?? ""}
            initialClientSecret={credentials?.clientSecret ?? ""}
            onSave={handleSaveCredentials}
          />
        </div>
      </main>

      <Toast
        open={toast.open}
        onOpenChange={(open) => setToast((t) => ({ ...t, open }))}
        variant={toast.variant}
        duration={5000}
      >
        <div className="flex flex-col gap-0.5">
          <ToastTitle>{toast.title}</ToastTitle>
          {toast.description && (
            <ToastDescription>{toast.description}</ToastDescription>
          )}
        </div>
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}
