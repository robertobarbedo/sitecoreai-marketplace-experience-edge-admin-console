"use client";

import { mdiCheckCircle, mdiAlertCircle, mdiLoading } from "@mdi/js";
import { Icon } from "@/lib/icon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Webhook, WebhookTestResult } from "@/src/types/edge";

interface WebhookTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: Webhook | null;
  /** Null while the call is still in flight. */
  result: WebhookTestResult | null;
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all">{value || "—"}</span>
    </div>
  );
}

export function WebhookTestDialog({
  open,
  onOpenChange,
  webhook,
  result,
}: WebhookTestDialogProps) {
  if (!webhook) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test {webhook.label || "webhook"}</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="flex items-center justify-center gap-2 py-12 text-text-subtle">
            <Icon path={mdiLoading} className="animate-spin" />
            Calling {webhook.uri}&hellip;
          </div>
        ) : (
          /* min-w-0: DialogContent is a grid, whose items default to
             min-width:auto — without it the code blocks below push the dialog
             wider than its max-w and spill past the rounded border. */
          <div className="flex min-w-0 flex-col">
            <div
              className={
                result.ok
                  ? "mb-2 flex items-center gap-2 rounded-md bg-success-bg px-3 py-2 text-sm font-medium text-success-fg"
                  : "mb-2 flex items-center gap-2 rounded-md bg-danger-bg px-3 py-2 text-sm font-medium text-danger-fg"
              }
            >
              <Icon path={result.ok ? mdiCheckCircle : mdiAlertCircle} />
              {result.errorMessage
                ? "The endpoint could not be reached"
                : `${result.status} ${result.statusText ?? ""} — ${
                    result.ok ? "endpoint accepted the call" : "endpoint rejected the call"
                  }`}
            </div>

            <DetailRow
              label="Request"
              value={
                <span className="font-mono text-xs">
                  {result.requestMethod} {result.requestUri}
                </span>
              }
            />
            <DetailRow label="Latency" value={`${result.latencyMs} ms`} />
            {result.errorMessage && (
              <DetailRow label="Error" value={result.errorMessage} />
            )}

            {result.requestBody && (
              <>
                <Separator className="my-3" />
                <h3 className="mb-1 text-sm font-medium">
                  Sent body
                  {webhook.body ? "" : " (generated — this webhook has no body configured)"}
                </h3>
                <pre className="max-h-48 w-full min-w-0 overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">
                  {result.requestBody}
                </pre>
              </>
            )}

            {result.responseBody !== undefined && (
              <>
                <Separator className="my-3" />
                <h3 className="mb-1 text-sm font-medium">
                  Response body
                  {result.responseTruncated ? " (truncated)" : ""}
                </h3>
                <pre className="max-h-48 w-full min-w-0 overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">
                  {result.responseBody || "(empty)"}
                </pre>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
