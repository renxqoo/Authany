"use client";

import { useState } from "react";
import { CopyableField } from "@/components/management/copyable-field";
import { SecretField } from "@/components/management/secret-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { revealApplicationSecret, rotateApplicationSecret } from "@/features/applications/application-api";

type ApplicationSecret = {
  created_at: string;
  hint: string;
  id: string;
  last_used_at?: string | null;
  revealable: boolean;
  status: string;
};

type ApplicationRecord = {
  app_id: string;
  id: string;
  is_protected?: boolean;
  secrets: ApplicationSecret[];
};

export function ApplicationSecretSection({
  app,
  refresh
}: {
  app: ApplicationRecord;
  refresh: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [issuedSecret, setIssuedSecret] = useState("");
  const activeSecret = app.secrets.find((secret) => secret.status === "active");
  const showRevealableActiveSecret = !issuedSecret && activeSecret?.revealable;

  async function rotate() {
    setError("");
    try {
      const result = await rotateApplicationSecret(app.id);
      setIssuedSecret(result.app_secret);
      await refresh();
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : "Secret rotation failed.");
    }
  }

  return (
    <Card className="rounded-[28px]">
      <CardHeader><CardTitle>App Secrets</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        <CopyableField label="App ID" value={app.app_id} />
        {issuedSecret ? (
          <SecretField label="New Active App Secret" value={issuedSecret} />
        ) : null}
        {showRevealableActiveSecret ? (
          <SecretField
            label={`Active secret (${activeSecret.hint})`}
            onReveal={async () => (await revealApplicationSecret(app.id, activeSecret.id)).app_secret}
          />
        ) : (
          <Alert>
            {issuedSecret
              ? "This newly rotated secret is now the active secret. Store it now because the UI will not show the same value twice."
              : activeSecret
                ? "Active secret cannot be revealed. Rotate it to issue a new revealable value."
                : "No active secret found."}
          </Alert>
        )}
        <div className="flex justify-end">
          <Button disabled={Boolean(app.is_protected)} onClick={() => void rotate()} type="button" variant="secondary">
            Rotate secret
          </Button>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Hint</Th>
              <Th>Status</Th>
              <Th>Issued</Th>
              <Th>Last used</Th>
            </tr>
          </thead>
          <tbody>
            {app.secrets.map((secret) => (
              <tr key={secret.id}>
                <Td><code>{secret.hint}</code></Td>
                <Td>{secret.status}</Td>
                <Td>{new Date(secret.created_at).toLocaleString()}</Td>
                <Td>{secret.last_used_at ? new Date(secret.last_used_at).toLocaleString() : "-"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CardContent>
    </Card>
  );
}
