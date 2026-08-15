"use client";

import {
  mdiCheckCircle,
  mdiAlertCircle,
  mdiCancel,
  mdiLoading,
  mdiHistory,
} from "@mdi/js";
import { Icon } from "@/lib/icon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Webhook, WebhookRun } from "@/src/types/edge";
import {
  summarizeRuns,
  formatRunTime,
  formatRelativeTime,
} from "@/src/utils/webhook-runs";

interface WebhookDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: Webhook | null;
  /** True while a fresher copy of the webhook is being fetched. */
  refreshing?: boolean;
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all">{value || "—"}</span>
    </div>
  );
}

/** One entry of the execution log Experience Edge keeps on the webhook. */
function RunRow({ run }: { run: WebhookRun }) {
  const failed = !run.success;
  const relative = formatRelativeTime(run.timestamp);

  return (
    <li className="flex items-start gap-2 py-1.5 text-sm">
      <Icon
        path={failed ? mdiAlertCircle : mdiCheckCircle}
        size={0.7}
        className={`mt-0.5 shrink-0 ${failed ? "text-danger-fg" : "text-success-fg"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={`font-medium ${failed ? "text-danger-fg" : ""}`}>
            {failed ? "Failed" : "Succeeded"}
          </span>
          <span className="text-xs text-text-subtle">
            {formatRunTime(run.timestamp)}
            {relative ? ` · ${relative}` : ""}
          </span>
        </div>
        {run.message && (
          <p className="mt-0.5 break-words text-xs text-text-subtle">{run.message}</p>
        )}
      </div>
    </li>
  );
}

export function WebhookDetailsDialog({
  open,
  onOpenChange,
  webhook,
  refreshing = false,
}: WebhookDetailsDialogProps) {
  const { runs, total, failed, consecutiveFailures } = summarizeRuns(webhook);

  if (!webhook) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {webhook.label || "Webhook"}
            {webhook.disabled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning-fg">
                <Icon path={mdiCancel} size={0.6} />
                Disabled
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* min-w-0: DialogContent is a grid, whose items default to
            min-width:auto — without it the body block below pushes the dialog
            wider than its max-w and spills past the rounded border. */}
        <div className="flex max-h-[70vh] min-w-0 flex-col overflow-y-auto">
          {webhook.disabled && (
            <div className="mb-3 rounded-lg border border-warning bg-warning-bg p-3 text-sm text-warning-fg">
              Experience Edge disabled this webhook after 10 consecutive failed
              executions. Fix the endpoint, then re-enable it by saving the
              webhook again.
            </div>
          )}

          <DetailRow label="ID" value={<span className="font-mono text-xs">{webhook.id}</span>} />
          <DetailRow label="URI" value={<span className="font-mono text-xs">{webhook.uri}</span>} />
          <DetailRow label="Method" value={webhook.method} />
          <DetailRow label="Execution mode" value={webhook.executionMode} />
          <DetailRow
            label="Status"
            value={
              webhook.disabled ? (
                <span className="text-warning-fg">Disabled by Experience Edge</span>
              ) : (
                "Enabled"
              )
            }
          />
          <DetailRow label="Tenant ID" value={webhook.tenantId && <span className="font-mono text-xs">{webhook.tenantId}</span>} />
          <DetailRow label="Created by" value={webhook.createdBy} />
          <DetailRow
            label="Created"
            value={webhook.created ? new Date(webhook.created).toLocaleString() : undefined}
          />

          {webhook.headers && Object.keys(webhook.headers).length > 0 && (
            <>
              <Separator className="my-3" />
              <h3 className="mb-1 text-sm font-medium">Headers</h3>
              {Object.entries(webhook.headers).map(([key, value]) => (
                <DetailRow key={key} label={key} value={value} />
              ))}
            </>
          )}

          {webhook.body && (
            <>
              <Separator className="my-3" />
              <h3 className="mb-1 text-sm font-medium">Body</h3>
              <pre className="max-h-48 w-full min-w-0 overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">
                {webhook.body}
              </pre>
            </>
          )}

          {webhook.bodyInclude && (
            <>
              <Separator className="my-3" />
              <h3 className="mb-1 text-sm font-medium">
                Body include
                <span className="ml-2 font-normal text-xs text-text-subtle">
                  merged into the OnUpdate payload
                </span>
              </h3>
              <pre className="max-h-48 w-full min-w-0 overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">
                {webhook.bodyInclude}
              </pre>
            </>
          )}

          <Separator className="my-3" />
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <Icon path={mdiHistory} size={0.7} />
              Recent runs
              {refreshing && (
                <Icon path={mdiLoading} size={0.6} className="animate-spin text-text-subtle" />
              )}
            </h3>
            {total > 0 && (
              <span className="text-xs text-text-subtle">
                {failed === 0
                  ? `${total} logged, all succeeded`
                  : `${failed} of ${total} failed`}
                {consecutiveFailures > 1 && (
                  <span className="text-danger-fg">
                    {" "}
                    · {consecutiveFailures} consecutive
                  </span>
                )}
              </span>
            )}
          </div>

          {total === 0 ? (
            <p className="py-2 text-sm text-text-subtle">
              Experience Edge has not logged any runs for this webhook yet. The
              log fills in as publishing triggers the webhook — manual tests
              from this console are not recorded there.
            </p>
          ) : (
            <ul className="divide-y divide-border-muted">
              {runs.map((run, index) => (
                <RunRow key={`${run.timestamp ?? "unknown"}-${index}`} run={run} />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
