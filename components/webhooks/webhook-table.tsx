"use client";

import {
  mdiPencil,
  mdiDelete,
  mdiEye,
  mdiSend,
  mdiLoading,
  mdiCancel,
} from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import type { Webhook } from "@/src/types/edge";
import {
  summarizeRuns,
  formatRelativeTime,
  formatRunTime,
} from "@/src/utils/webhook-runs";

interface WebhookTableProps {
  webhooks: Webhook[];
  onView: (webhook: Webhook) => void;
  onTest: (webhook: Webhook) => void;
  onEdit: (webhook: Webhook) => void;
  onDelete: (webhook: Webhook) => void;
  /** Id of the webhook whose test call is in flight, if any. */
  testingId?: string | null;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/**
 * Health at a glance, from the execution log Experience Edge returns with the
 * webhook: the outcome of the most recent run, plus how many failures are
 * stacked up behind it (Edge disables a webhook at 10 in a row).
 */
function LastRunCell({ webhook }: { webhook: Webhook }) {
  const { latest, consecutiveFailures, total } = summarizeRuns(webhook);

  if (!latest) {
    return (
      <span className="text-text-subtle" title="Experience Edge has not logged a run yet">
        No runs yet
      </span>
    );
  }

  const failed = !latest.success;
  const when = formatRelativeTime(latest.timestamp) ?? formatRunTime(latest.timestamp);

  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`font-medium ${failed ? "text-danger-fg" : "text-success-fg"}`}
        title={latest.message || formatRunTime(latest.timestamp)}
      >
        {failed ? "Failed" : "Succeeded"}
      </span>
      <span className="text-xs text-text-subtle" title={formatRunTime(latest.timestamp)}>
        {when}
        {consecutiveFailures > 1 && (
          <span className="text-danger-fg">
            {" "}
            · {consecutiveFailures} of {total} in a row
          </span>
        )}
      </span>
    </div>
  );
}

export function WebhookTable({
  webhooks,
  onView,
  onTest,
  onEdit,
  onDelete,
  testingId,
}: WebhookTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-muted bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-muted bg-surface-grey">
              <th className="px-4 py-4 font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Label
              </th>
              <th className="px-4 py-4 font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                URI
              </th>
              <th className="px-4 py-4 font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Method
              </th>
              <th className="px-4 py-4 font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Execution mode
              </th>
              <th className="px-4 py-4 font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Last run
              </th>
              <th className="px-4 py-4 font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Created
              </th>
              <th className="px-4 py-4 text-right font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {webhooks.map((webhook) => (
              <tr
                key={webhook.id}
                className="border-b border-border-muted last:border-b-0 hover:bg-surface-container-low/60"
              >
              <td className="px-4 py-3 font-medium">
                <div className="flex flex-col gap-0.5">
                  <span>{webhook.label || "—"}</span>
                  {webhook.disabled && (
                    <span
                      className="inline-flex w-fit items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning-fg"
                      title="Experience Edge disabled this webhook after 10 consecutive failures"
                    >
                      <Icon path={mdiCancel} size={0.6} />
                      Disabled
                    </span>
                  )}
                </div>
              </td>
              <td className="max-w-[320px] truncate px-4 py-3 font-mono text-xs" title={webhook.uri}>
                {webhook.uri}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-primary-bg px-2 py-0.5 text-xs font-semibold text-primary-fg">
                  {webhook.method}
                </span>
              </td>
              <td className="px-4 py-3">{webhook.executionMode ?? "—"}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <LastRunCell webhook={webhook} />
              </td>
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
                    onClick={() => onTest(webhook)}
                    disabled={testingId !== null && testingId !== undefined}
                    title={`Send a ${webhook.method} to ${webhook.uri}`}
                    aria-label={`Test ${webhook.label}`}
                  >
                    <Icon
                      path={testingId === webhook.id ? mdiLoading : mdiSend}
                      className={testingId === webhook.id ? "animate-spin" : ""}
                    />
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
    </div>
  );
}
