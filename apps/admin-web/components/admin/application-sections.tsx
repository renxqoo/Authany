"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { useI18n } from "@/components/i18n/language-provider";
import { revealApplicationSecret, rotateApplicationSecret } from "@/lib/admin/application-api";
import { CopyableField } from "./copyable-field";
import { SecretField } from "./secret-field";

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
  const { t } = useI18n();
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
      setError(rotateError instanceof Error ? rotateError.message : t("admin.failedRotateSecret"));
    }
  }

  return (
    <Card className="rounded-[28px]">
      <CardHeader><CardTitle>{t("application.secret.title")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        <CopyableField label={t("admin.app.appId")} value={app.app_id} />
        {issuedSecret ? (
          <SecretField label={t("admin.app.newSecretLabel")} value={issuedSecret} />
        ) : null}
        {showRevealableActiveSecret ? (
          <SecretField
            label={t("admin.app.activeSecret", { hint: activeSecret.hint })}
            onReveal={async () => (await revealApplicationSecret(app.id, activeSecret.id)).app_secret}
          />
        ) : (
          <Alert>
            {issuedSecret
              ? t("admin.app.newSecretActiveNotice")
              : activeSecret
                ? t("admin.app.activeSecretNotRevealable")
                : t("admin.app.activeSecretMissing")}
          </Alert>
        )}
        <div className="flex justify-end">
          <Button disabled={Boolean(app.is_protected)} onClick={() => void rotate()} type="button" variant="secondary">
            {t("admin.app.rotateSecret")}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>{t("field.hint")}</Th>
                <Th>{t("field.status")}</Th>
                <Th>{t("field.issuedAt")}</Th>
                <Th>{t("field.lastUsedAt")}</Th>
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
        </div>
      </CardContent>
    </Card>
  );
}
