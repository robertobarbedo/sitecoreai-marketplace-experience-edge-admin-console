"use client";

import { mdiConnection } from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ConnectionGateProps {
  onConfigure: () => void;
}

export function ConnectionGate({ onConfigure }: ConnectionGateProps) {
  return (
    <div className="w-full pt-16">
      <Card style="outline" padding="lg" className="w-full text-center">
        <CardHeader className="items-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary-bg text-primary-fg">
            <Icon path={mdiConnection} size={1} />
          </div>
          <CardTitle className="text-lg font-bold">Connect to Experience Edge</CardTitle>
          <CardDescription className="text-text-subtle">
            This app manages webhooks, cache, and settings through the
            Experience Edge Admin API. Marketplace apps have no default access
            to this API, so you need an <strong>Edge administration
            client</strong> (Client ID and Client Secret) created in the
            SitecoreAI Deploy app or Cloud Portal for this environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Button onClick={onConfigure}>Configure credentials</Button>
          <p className="max-w-2xl text-sm text-text-subtle">
            <a
              href="https://deploy.sitecorecloud.io/credentials/environment"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Click here (ctrl + click) to create credentials for Edge administration
            </a>{" "}
            . In SitecoreAI Deploy, choose{" "}
            <strong>Create credentials</strong>, then{" "}
            <strong>Edge administration</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
