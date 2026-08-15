"use client";

import { useCallback, useEffect, useState } from "react";
import { mdiPlus, mdiRefresh, mdiLoading, mdiWebhook } from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import { WebhookTable } from "./webhook-table";
import { WebhookFormDialog } from "./webhook-form-dialog";
import { WebhookDetailsDialog } from "./webhook-details-dialog";
import { WebhookTestDialog } from "./webhook-test-dialog";
import { ConfirmDestructiveDialog } from "@/components/confirm-destructive-dialog";
import {
  useEdgeApi,
  isInvalidCredentialsError,
  type EdgeApiCredentials,
} from "@/src/utils/hooks/useEdgeApi";
import type {
  Webhook,
  WebhookInput,
  WebhookTestResult,
} from "@/src/types/edge";

interface WebhooksTabProps {
  credentials: EdgeApiCredentials;
  showToast: (
    title: string,
    description?: string,
    variant?: "default" | "success" | "error" | "warning",
  ) => void;
  onAuthError: () => void;
}

export function WebhooksTab({
  credentials,
  showToast,
  onAuthError,
}: WebhooksTabProps) {
  const { call } = useEdgeApi(credentials);

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Webhook | null>(null);
  /** Record shown in the details dialog — re-read on open so runs are current. */
  const [details, setDetails] = useState<Webhook | null>(null);
  const [detailsRefreshing, setDetailsRefreshing] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  /** The webhook the result dialog describes — outlives the in-flight call. */
  const [testWebhook, setTestWebhook] = useState<Webhook | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);

  const handleError = useCallback(
    (error: unknown, action: string) => {
      console.error(`Error ${action}:`, error);
      if (isInvalidCredentialsError(error)) {
        onAuthError();
      } else {
        showToast(
          `Failed to ${action}`,
          error instanceof Error ? error.message : undefined,
          "error",
        );
      }
    },
    [onAuthError, showToast],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await call<Webhook[]>("/webhooks");
      setWebhooks(list);
    } catch (error) {
      handleError(error, "load webhooks");
    } finally {
      setLoading(false);
    }
  }, [call, handleError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSubmit = async (input: WebhookInput) => {
    try {
      if (selected) {
        await call<Webhook>(`/webhooks/${encodeURIComponent(selected.id)}`, {
          method: "PUT",
          body: JSON.stringify(input),
        });
        showToast("Webhook updated", input.label, "success");
      } else {
        await call<Webhook>("/webhooks", {
          method: "POST",
          body: JSON.stringify(input),
        });
        showToast("Webhook created", input.label, "success");
      }
      await refresh();
    } catch (error) {
      handleError(error, selected ? "update webhook" : "create webhook");
      throw error;
    }
  };

  /**
   * Opens the details dialog on the record from the list, then re-reads the
   * webhook by id. The configuration rarely changes, but `lastRuns` does — and
   * a single GET is the only way to see the execution log Edge keeps.
   */
  const handleView = async (webhook: Webhook) => {
    setSelected(webhook);
    setDetails(webhook);
    setDetailsOpen(true);
    setDetailsRefreshing(true);
    try {
      const fresh = await call<Webhook>(
        `/webhooks/${encodeURIComponent(webhook.id)}`,
      );
      setDetails(fresh);
      // Keep the list's Last run column consistent with what the dialog shows.
      setWebhooks((list) => list.map((w) => (w.id === fresh.id ? fresh : w)));
    } catch (error) {
      // Non-fatal: the dialog already shows the record from the list.
      if (isInvalidCredentialsError(error)) {
        onAuthError();
      } else {
        console.error("Error refreshing webhook details:", error);
      }
    } finally {
      setDetailsRefreshing(false);
    }
  };

  /**
   * Fires the webhook's own URI/method/headers/body from the server. A non-2xx
   * or unreachable endpoint comes back as a result, not a thrown error — the
   * dialog is the report either way; only the call itself failing is a toast.
   */
  const handleTest = async (webhook: Webhook) => {
    setTestWebhook(webhook);
    setTestingId(webhook.id);
    setTestResult(null);
    setTestOpen(true);
    try {
      const result = await call<WebhookTestResult>(
        `/webhooks/${encodeURIComponent(webhook.id)}/test`,
        { method: "POST" },
      );
      setTestResult(result);
    } catch (error) {
      setTestOpen(false);
      handleError(error, "test webhook");
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await call<void>(`/webhooks/${encodeURIComponent(selected.id)}`, {
        method: "DELETE",
      });
      showToast("Webhook deleted", selected.label, "success");
      await refresh();
    } catch (error) {
      handleError(error, "delete webhook");
      throw error;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-muted bg-white p-4">
        <p className="text-sm text-text-subtle">
          Webhooks are invoked by Experience Edge when publishing completes or
          content is updated.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <Icon path={mdiRefresh} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelected(null);
              setFormOpen(true);
            }}
          >
            <Icon path={mdiPlus} />
            New webhook
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-subtle">
          <Icon path={mdiLoading} className="animate-spin" />
          Loading webhooks&hellip;
        </div>
      ) : webhooks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border-muted bg-white py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary-bg text-primary-fg">
            <Icon path={mdiWebhook} size={1} />
          </div>
          <div>
            <p className="font-bold">No webhooks yet</p>
            <p className="text-sm text-text-subtle">
              Create a webhook to notify your systems when content is published.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setSelected(null);
              setFormOpen(true);
            }}
          >
            <Icon path={mdiPlus} />
            New webhook
          </Button>
        </div>
      ) : (
        <WebhookTable
          webhooks={webhooks}
          testingId={testingId}
          onView={handleView}
          onTest={handleTest}
          onEdit={(w) => {
            setSelected(w);
            setFormOpen(true);
          }}
          onDelete={(w) => {
            setSelected(w);
            setDeleteOpen(true);
          }}
        />
      )}

      <WebhookFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        webhook={selected}
        onSubmit={handleSubmit}
      />

      <WebhookDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        webhook={details}
        refreshing={detailsRefreshing}
      />

      <WebhookTestDialog
        open={testOpen}
        // Closing mid-flight would strand the result; the in-flight view has
        // no controls, so just let it finish.
        onOpenChange={(open) => !testingId && setTestOpen(open)}
        webhook={testWebhook}
        result={testResult}
      />

      <ConfirmDestructiveDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete webhook"
        description={
          <>
            This permanently deletes the webhook{" "}
            <strong>{selected?.label}</strong>. Systems relying on it will no
            longer be notified when content is published.
          </>
        }
        confirmLabel="Delete webhook"
        onConfirm={handleDelete}
      />
    </div>
  );
}
