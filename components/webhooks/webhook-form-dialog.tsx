"use client";

import { useEffect, useState } from "react";
import { mdiPlus, mdiDelete, mdiLoading } from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Webhook,
  WebhookInput,
  WebhookMethod,
  WebhookExecutionMode,
} from "@/src/types/edge";

interface HeaderRow {
  key: string;
  value: string;
}

interface WebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Webhook being edited, or null when creating a new one. */
  webhook: Webhook | null;
  onSubmit: (input: WebhookInput) => Promise<void>;
}

const METHODS: WebhookMethod[] = ["POST", "PUT", "GET", "DELETE"];
const EXECUTION_MODES: WebhookExecutionMode[] = ["OnEnd", "OnUpdate"];

function toHeaderRows(headers?: Record<string, string>): HeaderRow[] {
  if (!headers) return [];
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

export function WebhookFormDialog({
  open,
  onOpenChange,
  webhook,
  onSubmit,
}: WebhookFormDialogProps) {
  const [label, setLabel] = useState("");
  const [uri, setUri] = useState("");
  const [method, setMethod] = useState<WebhookMethod>("POST");
  const [executionMode, setExecutionMode] = useState<WebhookExecutionMode>("OnEnd");
  const [headers, setHeaders] = useState<HeaderRow[]>([]);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(webhook?.label ?? "");
      setUri(webhook?.uri ?? "");
      setMethod(webhook?.method ?? "POST");
      setExecutionMode(webhook?.executionMode ?? "OnEnd");
      setHeaders(toHeaderRows(webhook?.headers));
      setBody(webhook?.body ?? "");
      setPending(false);
    }
  }, [open, webhook]);

  const uriValid = uri.startsWith("https://");
  const canSubmit = label.trim() !== "" && uriValid && !pending;

  const handleSubmit = async () => {
    setPending(true);
    try {
      const headerRecord: Record<string, string> = {};
      for (const row of headers) {
        if (row.key.trim()) {
          headerRecord[row.key.trim()] = row.value;
        }
      }

      await onSubmit({
        label: label.trim(),
        uri: uri.trim(),
        method,
        executionMode,
        headers: Object.keys(headerRecord).length ? headerRecord : undefined,
        body: body.trim() || undefined,
      });
      onOpenChange(false);
    } catch {
      // Caller reports the error via toast; keep the dialog open for edits.
      setPending(false);
    }
  };

  const updateHeader = (index: number, patch: Partial<HeaderRow>) => {
    setHeaders((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {webhook ? "Edit webhook" : "Create webhook"}
          </DialogTitle>
          <DialogDescription>
            The webhook is invoked by Experience Edge when content is
            published. The URI must use HTTPS.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="wh-label" className="text-sm font-medium">
              Label
            </label>
            <Input
              id="wh-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Rebuild front-end site"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="wh-uri" className="text-sm font-medium">
              URI
            </label>
            <Input
              id="wh-uri"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="https://example.com/hooks/publish"
              aria-invalid={uri !== "" && !uriValid}
            />
            {uri !== "" && !uriValid && (
              <p className="text-danger-fg text-xs">
                The URI must start with https://
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Method</label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as WebhookMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Execution mode</label>
              <Select
                value={executionMode}
                onValueChange={(v) => setExecutionMode(v as WebhookExecutionMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXECUTION_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Headers</label>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setHeaders((rows) => [...rows, { key: "", value: "" }])}
              >
                <Icon path={mdiPlus} />
                Add header
              </Button>
            </div>
            {headers.length === 0 && (
              <p className="text-muted-foreground text-xs">No custom headers.</p>
            )}
            {headers.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={row.key}
                  onChange={(e) => updateHeader(index, { key: e.target.value })}
                  placeholder="Header name"
                  className="h-8"
                />
                <Input
                  value={row.value}
                  onChange={(e) => updateHeader(index, { value: e.target.value })}
                  placeholder="Value"
                  className="h-8"
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  colorScheme="danger"
                  onClick={() =>
                    setHeaders((rows) => rows.filter((_, i) => i !== index))
                  }
                  aria-label="Remove header"
                >
                  <Icon path={mdiDelete} />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="wh-body" className="text-sm font-medium">
              Body <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="wh-body"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='e.g. { "trigger": "publish" }'
              className="font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {pending && (
              <Icon path={mdiLoading} size={0.8} className="animate-spin" />
            )}
            {webhook ? "Save changes" : "Create webhook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
