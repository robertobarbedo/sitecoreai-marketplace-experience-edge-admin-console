"use client";

import { useEffect, useState } from "react";
import {
  mdiEye,
  mdiEyeOff,
  mdiCheckCircle,
  mdiAlertCircle,
  mdiLoading,
  mdiLock,
} from "@mdi/js";
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
  /** True when an encrypted secret is already stored for this environment. */
  hasStoredSecret: boolean;
  /**
   * The stored secret in its sealed form. Opaque here — it is only forwarded
   * to the server so the user can re-test or keep the existing secret without
   * typing it again. The plaintext is never available to this component.
   */
  storedSecret: string;
  /** ISO timestamp of the last credential save, if any. */
  secretUpdatedAt?: string;
  onSave: (credentials: {
    clientId: string;
    secretCipher: string;
  }) => Promise<void>;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "valid"; sealedSecret: string }
  | { status: "invalid"; message: string };

function formatUpdatedAt(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function SettingsModal({
  open,
  onOpenChange,
  initialClientId,
  hasStoredSecret,
  storedSecret,
  secretUpdatedAt,
  onSave,
}: SettingsModalProps) {
  const [clientId, setClientId] = useState(initialClientId);
  // Always starts empty: the stored secret is encrypted and is never rendered
  // back into the form.
  const [newSecret, setNewSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [saving, setSaving] = useState(false);

  // Reset the form each time the dialog opens
  useEffect(() => {
    if (open) {
      setClientId(initialClientId);
      setNewSecret("");
      setShowSecret(false);
      setTest({ status: "idle" });
      setSaving(false);
    }
  }, [open, initialClientId]);

  // The stored secret is sealed for its Client ID, so a changed Client ID
  // needs the secret entered again.
  const clientIdChanged = hasStoredSecret && clientId.trim() !== initialClientId;
  const keepingStoredSecret =
    hasStoredSecret && !clientIdChanged && newSecret.trim() === "";
  const canTest =
    clientId.trim() !== "" && (newSecret.trim() !== "" || keepingStoredSecret);
  const canSave = test.status === "valid" && !saving;
  const updatedAt = formatUpdatedAt(secretUpdatedAt);

  const handleTest = async () => {
    setTest({ status: "testing" });
    const result = await validateEdgeCredentials({
      clientId: clientId.trim(),
      clientSecret: keepingStoredSecret ? storedSecret : newSecret.trim(),
    });

    if (result.ok) {
      setTest({ status: "valid", sealedSecret: result.sealedSecret });
      return;
    }

    let message: string;
    switch (result.error) {
      case "invalid_credentials":
        message = "The Client ID or Client Secret is not valid for this environment.";
        break;
      case "secret_unreadable":
        message =
          "The stored secret could not be decrypted. Enter the Client Secret again to replace it.";
        break;
      case "encryption_unavailable":
        message =
          "Secret encryption is not configured on the server (EDGE_SECRET_ENCRYPTION_KEY). Credentials cannot be saved until an administrator sets it.";
        break;
      default:
        message = result.detail || "Could not reach the Experience Edge Admin API.";
    }
    setTest({ status: "invalid", message });
  };

  const handleSave = async () => {
    if (test.status !== "valid") return;
    setSaving(true);
    try {
      await onSave({
        clientId: clientId.trim(),
        secretCipher: test.sealedSecret,
      });
      // Drop the plaintext from component state as soon as it is stored.
      setNewSecret("");
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
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>
                Enter the Client ID and Client Secret of an Edge administration
                client for this environment. The secret is encrypted on the
                server before it is stored in the Sitecore content tree under
                /sitecore/system/Modules, and is never shown again.
              </p>
              <p>
                No credentials are sent or stored outside of your organization.
              </p>
            </div>
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
                value={newSecret}
                autoComplete="off"
                onChange={(e) => {
                  setNewSecret(e.target.value);
                  invalidateTest();
                }}
                placeholder={
                  !hasStoredSecret
                    ? "Paste the client secret"
                    : clientIdChanged
                      ? "Enter the secret again (Client ID changed)"
                      : "Leave blank to keep the stored secret"
                }
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
            {hasStoredSecret && (
              <p className="flex items-start gap-1.5 text-xs text-text-subtle">
                <Icon path={mdiLock} size={0.6} className="mt-0.5 shrink-0" />
                <span>
                  A client secret is stored encrypted
                  {updatedAt ? ` (last updated ${updatedAt})` : ""} and cannot be
                  displayed. Type a new secret to replace it.
                </span>
              </p>
            )}
          </div>

          {test.status === "valid" && (
            <div className="flex items-center gap-2 text-success-fg text-sm">
              <Icon path={mdiCheckCircle} size={0.8} />
              Connection successful
            </div>
          )}
          {test.status === "invalid" && (
            <div className="flex items-start gap-2 text-danger-fg text-sm">
              <Icon path={mdiAlertCircle} size={0.8} className="mt-0.5 shrink-0" />
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

        <p className="-mt-2 text-left text-[10px] text-text-subtle">
          Developed by Roberto Barbedo
        </p>
      </DialogContent>
    </Dialog>
  );
}
