"use client";

import { useCallback, useEffect, useState } from "react";
import { mdiLoading, mdiChevronDown, mdiChevronUp, mdiRefresh } from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useEdgeApi,
  isInvalidCredentialsError,
  type EdgeApiCredentials,
} from "@/src/utils/hooks/useEdgeApi";
import type { EdgeSettings } from "@/src/types/edge";

interface EdgeSettingsTabProps {
  credentials: EdgeApiCredentials;
  showToast: (
    title: string,
    description?: string,
    variant?: "default" | "success" | "error" | "warning",
  ) => void;
  onAuthError: () => void;
}

/** Known settings rendered as dedicated fields; everything else stays in the raw JSON. */
const KNOWN_FIELDS: Array<{
  key: string;
  label: string;
  description: string;
  type: "text" | "boolean";
}> = [
  {
    key: "contentCacheTtl",
    label: "Content cache TTL",
    description: "Time-to-live for cached content (e.g. 04:00:00).",
    type: "text",
  },
  {
    key: "contentCacheAutoClear",
    label: "Auto-clear content cache",
    description: "Clear the content cache automatically when publishing.",
    type: "boolean",
  },
  {
    key: "mediaCacheTtl",
    label: "Media cache TTL",
    description: "Time-to-live for cached media (e.g. 04:00:00).",
    type: "text",
  },
  {
    key: "mediaCacheAutoClear",
    label: "Auto-clear media cache",
    description: "Clear the media cache automatically when publishing.",
    type: "boolean",
  },
];

export function EdgeSettingsTab({
  credentials,
  showToast,
  onAuthError,
}: EdgeSettingsTabProps) {
  const { call } = useEdgeApi(credentials);

  const [settings, setSettings] = useState<EdgeSettings | null>(null);
  const [draft, setDraft] = useState<EdgeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

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
      const data = await call<EdgeSettings>("/settings");
      setSettings(data);
      setDraft(data);
    } catch (error) {
      handleError(error, "load settings");
    } finally {
      setLoading(false);
    }
  }, [call, handleError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await call<EdgeSettings>("/settings", {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      setSettings(updated);
      setDraft(updated);
      showToast("Settings saved", undefined, "success");
    } catch (error) {
      handleError(error, "save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Icon path={mdiLoading} className="animate-spin" />
        Loading settings&hellip;
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-muted-foreground">Could not load the environment settings.</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          <Icon path={mdiRefresh} />
          Retry
        </Button>
      </div>
    );
  }

  const knownKeys = KNOWN_FIELDS.filter((f) => f.key in draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card style="outline" padding="md">
        <CardHeader>
          <CardTitle>Environment settings</CardTitle>
          <CardDescription className="text-muted-foreground">
            Cache TTLs and auto-clear behavior for this environment&apos;s
            Experience Edge.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {knownKeys.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No recognized settings fields returned by the API &mdash; use the
              raw view below.
            </p>
          )}
          {knownKeys.map((field) =>
            field.type === "boolean" ? (
              <label
                key={field.key}
                className="flex cursor-pointer items-start gap-3"
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-(--primary)"
                  checked={Boolean(draft[field.key])}
                  onChange={(e) =>
                    setDraft({ ...draft, [field.key]: e.target.checked })
                  }
                />
                <span>
                  <span className="block text-sm font-medium">{field.label}</span>
                  <span className="block text-muted-foreground text-xs">
                    {field.description}
                  </span>
                </span>
              </label>
            ) : (
              <div key={field.key} className="flex flex-col gap-1.5">
                <label htmlFor={`setting-${field.key}`} className="text-sm font-medium">
                  {field.label}
                </label>
                <Input
                  id={`setting-${field.key}`}
                  value={String(draft[field.key] ?? "")}
                  onChange={(e) =>
                    setDraft({ ...draft, [field.key]: e.target.value })
                  }
                  className="max-w-xs font-mono"
                />
                <p className="text-muted-foreground text-xs">{field.description}</p>
              </div>
            ),
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={!dirty || saving}>
              {saving && (
                <Icon path={mdiLoading} size={0.8} className="animate-spin" />
              )}
              Save settings
            </Button>
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => setDraft(settings)}
                disabled={saving}
              >
                Discard changes
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Icon path={showRaw ? mdiChevronUp : mdiChevronDown} size={0.8} />
          Raw API response
        </button>
        {showRaw && (
          <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-muted p-4 font-mono text-xs">
            {JSON.stringify(settings, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
