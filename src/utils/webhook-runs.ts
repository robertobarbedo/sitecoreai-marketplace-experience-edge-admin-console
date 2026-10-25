import type { Webhook, WebhookRun } from "@/src/types/edge";

/**
 * Helpers for the execution log Experience Edge keeps on each webhook
 * (`lastRuns`). The API does not document an order, so everything here works
 * from a defensively sorted copy: newest run first, entries without a usable
 * timestamp last.
 */

export interface WebhookRunSummary {
  /** Newest first. */
  runs: WebhookRun[];
  latest?: WebhookRun;
  total: number;
  failed: number;
  /** Failures at the head of the log — what Edge counts towards auto-disabling. */
  consecutiveFailures: number;
}

function timeOf(run: WebhookRun): number {
  const value = run.timestamp ? new Date(run.timestamp).getTime() : NaN;
  return Number.isNaN(value) ? -Infinity : value;
}

export function summarizeRuns(webhook: Webhook | null): WebhookRunSummary {
  const runs = [...(webhook?.lastRuns ?? [])].sort((a, b) => timeOf(b) - timeOf(a));

  let consecutiveFailures = 0;
  for (const run of runs) {
    if (run.success) break;
    consecutiveFailures += 1;
  }

  return {
    runs,
    latest: runs[0],
    total: runs.length,
    failed: runs.filter((run) => !run.success).length,
    consecutiveFailures,
  };
}

export function formatRunTime(value?: string): string {
  if (!value) return "Unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/** "just now" / "12 min ago" / "3 days ago" — undefined when unusable. */
export function formatRelativeTime(value?: string): string | undefined {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return undefined;

  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 0) return undefined;
  if (seconds < 60) return "just now";

  const units: [limit: number, size: number, name: string][] = [
    [3600, 60, "min"],
    [86400, 3600, "hour"],
    [2592000, 86400, "day"],
    [31536000, 2592000, "month"],
    [Infinity, 31536000, "year"],
  ];

  for (const [limit, size, name] of units) {
    if (seconds < limit) {
      const amount = Math.floor(seconds / size);
      return `${amount} ${name}${amount === 1 ? "" : "s"} ago`;
    }
  }
  return undefined;
}
