"use client";

import { mdiPencil, mdiDelete, mdiEye } from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import type { Webhook } from "@/src/types/edge";

interface WebhookTableProps {
  webhooks: Webhook[];
  onView: (webhook: Webhook) => void;
  onEdit: (webhook: Webhook) => void;
  onDelete: (webhook: Webhook) => void;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function WebhookTable({
  webhooks,
  onView,
  onEdit,
  onDelete,
}: WebhookTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted text-left text-muted-foreground">
            <th className="px-4 py-3 font-medium">Label</th>
            <th className="px-4 py-3 font-medium">URI</th>
            <th className="px-4 py-3 font-medium">Method</th>
            <th className="px-4 py-3 font-medium">Execution mode</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {webhooks.map((webhook) => (
            <tr
              key={webhook.id}
              className="border-b border-border last:border-b-0 hover:bg-muted/60"
            >
              <td className="px-4 py-3 font-medium">{webhook.label || "—"}</td>
              <td className="max-w-[320px] truncate px-4 py-3 font-mono text-xs" title={webhook.uri}>
                {webhook.uri}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-primary-bg px-2 py-0.5 text-xs font-semibold text-primary-fg">
                  {webhook.method}
                </span>
              </td>
              <td className="px-4 py-3">{webhook.executionMode ?? "—"}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(webhook.created)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onView(webhook)}
                    aria-label={`View ${webhook.label}`}
                  >
                    <Icon path={mdiEye} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(webhook)}
                    aria-label={`Edit ${webhook.label}`}
                  >
                    <Icon path={mdiPencil} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    colorScheme="danger"
                    onClick={() => onDelete(webhook)}
                    aria-label={`Delete ${webhook.label}`}
                  >
                    <Icon path={mdiDelete} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
