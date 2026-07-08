"use client";

import { useEffect, useState } from "react";
import { mdiEye, mdiEyeOff, mdiCheckCircle, mdiAlertCircle, mdiLoading } from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { validateEdgeCredentials } from "@/src/utils/hooks/useEdgeApi";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialClientId: string;
  initialClientSecret: string;
  onSave: (credentials: { clientId: string; clientSecret: string }) => Promise<void>;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "valid" }
  | { status: "invalid"; message: string };

export function SettingsModal({
  open,
  onOpenChange,
  initialClientId,
  initialClientSecret,
  onSave,
}: SettingsModalProps) {
  const [clientId, setClientId] = useState(initialClientId);
  const [clientSecret, setClientSecret] = useState(initialClientSecret);
  const [showSecret, setShowSecret] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [saving, setSaving] = useState(false);

  // Reset the form each time the dialog opens
  useEffect(() => {
    if (open) {
      setClientId(initialClientId);
      setClientSecret(initialClientSecret);
      setShowSecret(false);
      setTest({ status: "idle" });
      setSaving(false);
    }
  }, [open, initialClientId, initialClientSecret]);

  const canTest = clientId.trim() !== "" && clientSecret.trim() !== "";
  const canSave = test.status === "valid" && !saving;

  const handleTest = async () => {
    setTest({ status: "testing" });
    const result = await validateEdgeCredentials({
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });
    if (result.ok) {
      setTest({ status: "valid" });
    } else {
      setTest({
        status: "invalid",
        message:
          result.error === "invalid_credentials"
            ? "The Client ID or Client Secret is not valid for this environment."
            : result.detail || "Could not reach the Experience Edge Admin API.",
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const invalidateTest = () => {
    if (test.status !== "idle") {
      setTest({ status: "idle" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edge administration credentials</DialogTitle>
          <DialogDescription>
            Enter the Client ID and Client Secret of an Edge administration
            client for this environment. The credentials are stored in the
            Sitecore content tree under /sitecore/system/Modules.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edge-client-id" className="text-sm font-medium">
              Client ID
            </label>
            <Input
              id="edge-client-id"
              value={clientId}
              autoComplete="off"
              onChange={(e) => {
                setClientId(e.target.value);
                invalidateTest();
              }}
              placeholder="e.g. AbCdEf123..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edge-client-secret" className="text-sm font-medium">
              Client Secret
            </label>
            <div className="relative">
              <Input
                id="edge-client-secret"
                type={showSecret ? "text" : "password"}
                value={clientSecret}
                autoComplete="off"
                onChange={(e) => {
                  setClientSecret(e.target.value);
                  invalidateTest();
                }}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label={showSecret ? "Hide secret" : "Show secret"}
              >
                <Icon path={showSecret ? mdiEyeOff : mdiEye} size={0.8} />
              </button>
            </div>
          </div>

          {test.status === "valid" && (
            <div className="flex items-center gap-2 text-success-fg text-sm">
              <Icon path={mdiCheckCircle} size={0.8} />
              Connection successful
            </div>
          )}
          {test.status === "invalid" && (
            <div className="flex items-center gap-2 text-danger-fg text-sm">
              <Icon path={mdiAlertCircle} size={0.8} />
              {test.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!canTest || test.status === "testing"}
          >
            {test.status === "testing" && (
              <Icon path={mdiLoading} size={0.8} className="animate-spin" />
            )}
            Test connection
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving && (
              <Icon path={mdiLoading} size={0.8} className="animate-spin" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
