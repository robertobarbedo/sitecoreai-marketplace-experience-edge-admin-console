"use client";

import { useCallback, useState } from "react";
import { mdiCached, mdiDatabaseRemove } from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDestructiveDialog } from "@/components/confirm-destructive-dialog";
import {
  useEdgeApi,
  isInvalidCredentialsError,
  type EdgeApiCredentials,
} from "@/src/utils/hooks/useEdgeApi";

interface CacheTabProps {
  credentials: EdgeApiCredentials;
  showToast: (
    title: string,
    description?: string,
    variant?: "default" | "success" | "error" | "warning",
  ) => void;
  onAuthError: () => void;
}

export function CacheTab({ credentials, showToast, onAuthError }: CacheTabProps) {
  const { call } = useEdgeApi(credentials);

  const [clearCacheOpen, setClearCacheOpen] = useState(false);
  const [deleteContentOpen, setDeleteContentOpen] = useState(false);

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

  const handleClearCache = async () => {
    try {
      await call<void>("/cache", { method: "DELETE" });
      showToast(
        "Cache cleared",
        "The Experience Edge cache for this environment was cleared.",
        "success",
      );
    } catch (error) {
      handleError(error, "clear the cache");
      throw error;
    }
  };

  const handleDeleteContent = async () => {
    try {
      await call<void>("/content", { method: "DELETE" });
      showToast(
        "Content deleted",
        "All environment data was removed from Experience Edge.",
        "success",
      );
    } catch (error) {
      handleError(error, "delete the content");
      throw error;
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card style="outline" padding="md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon path={mdiCached} size={0.9} className="text-primary-fg" />
            <CardTitle>Clear cache</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Clears the entire Experience Edge delivery cache for this
            environment. Content stays published; the cache is rebuilt on the
            next requests. Expect a temporary increase in response times.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            colorScheme="danger"
            onClick={() => setClearCacheOpen(true)}
          >
            Clear cache
          </Button>
        </CardContent>
      </Card>

      <Card style="outline" padding="md" className="border-danger/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon path={mdiDatabaseRemove} size={0.9} className="text-danger-fg" />
            <CardTitle>Delete all content</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Removes <strong>all published content</strong> of this environment
            from Experience Edge. Delivery APIs will return no data until you
            publish again. This cannot be undone from this console.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button colorScheme="danger" onClick={() => setDeleteContentOpen(true)}>
            Delete all content
          </Button>
        </CardContent>
      </Card>

      <ConfirmDestructiveDialog
        open={clearCacheOpen}
        onOpenChange={setClearCacheOpen}
        title="Clear the Experience Edge cache?"
        description="The delivery cache for this environment will be cleared and rebuilt on subsequent requests."
        confirmWord="CLEAR"
        confirmLabel="Clear cache"
        onConfirm={handleClearCache}
      />

      <ConfirmDestructiveDialog
        open={deleteContentOpen}
        onOpenChange={setDeleteContentOpen}
        title="Delete ALL content from Experience Edge?"
        description={
          <>
            All published content of this environment is removed from
            Experience Edge. Sites and applications consuming the delivery
            APIs will stop receiving data until content is published again.{" "}
            <strong>This action cannot be undone.</strong>
          </>
        }
        confirmWord="DELETE"
        confirmLabel="Delete all content"
        onConfirm={handleDeleteContent}
      />
    </div>
  );
}
