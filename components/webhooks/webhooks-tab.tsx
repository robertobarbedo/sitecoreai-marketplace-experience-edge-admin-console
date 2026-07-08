"use client";

import { useCallback, useEffect, useState } from "react";
import { mdiPlus, mdiRefresh, mdiLoading, mdiWebhook } from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import { WebhookTable } from "./webhook-table";
import { WebhookFormDialog } from "./webhook-form-dialog";
import { WebhookDetailsDialog } from "./webhook-details-dialog";
import { ConfirmDestructiveDialog } from "@/components/confirm-destructive-dialog";
import {
  useEdgeApi,
  isInvalidCredentialsError,
  type EdgeApiCredentials,
} from "@/src/utils/hooks/useEdgeApi";
import type { Webhook, WebhookInput } from "@/src/types/edge";

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
          onView={(w) => {
            setSelected(w);
            setDetailsOpen(true);
          }}
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
        webhook={selected}
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
