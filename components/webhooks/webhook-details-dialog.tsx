"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Webhook } from "@/src/types/edge";

interface WebhookDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: Webhook | null;
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all">{value || "—"}</span>
    </div>
  );
}

export function WebhookDetailsDialog({
  open,
  onOpenChange,
  webhook,
}: WebhookDetailsDialogProps) {
  if (!webhook) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{webhook.label || "Webhook"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col">
          <DetailRow label="ID" value={<span className="font-mono text-xs">{webhook.id}</span>} />
          <DetailRow label="URI" value={<span className="font-mono text-xs">{webhook.uri}</span>} />
          <DetailRow label="Method" value={webhook.method} />
          <DetailRow label="Execution mode" value={webhook.executionMode} />
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
              <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                {webhook.body}
              </pre>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
