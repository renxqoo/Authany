"use client";

import { useMemo, useState } from "react";
import { SecretField } from "./secret-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { useI18n } from "@/components/i18n/language-provider";
import { issueCallerCredential, revokeCallerCredential } from "@/lib/admin/agent-api";

type AgentCredential = {
  credential_hint: string;
  credential_type: string;
  id: string;
  issued_at: string;
  last_used_at?: string | null;
  status: string;
};

type AgentRuntime = {
  id: string;
  runtime_id: string;
  runtime_mode: string;
  runtime_type: string;
  status: string;
  target_connections: Array<{
    connection_id: string;
    grant_count: number;
    id: string;
    status: string;
    target_resource: string;
  }>;
};

type AgentRecord = {
  credentials: AgentCredential[];
  id: string;
  runtimes: AgentRuntime[];
  status: string;
};

export function AgentOperationsSection({
  agent,
  refresh
}: {
  agent: AgentRecord;
  refresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [issuedCredential, setIssuedCredential] = useState("");
  const connections = useMemo(() => agent.runtimes.flatMap((runtime) => runtime.target_connections), [agent.runtimes]);

  async function issue() {
    setError("");
    try {
      const result = await issueCallerCredential(agent.id, {});
      setIssuedCredential(result.caller_credential);
      await refresh();
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : t("admin.failedIssueCredential"));
    }
  }

  async function revoke(id: string) {
    setError("");
    try {
      await revokeCallerCredential(id);
      await refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : t("admin.failedRevokeCredential"));
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="rounded-[28px]">
        <CardHeader><CardTitle>{t("resource.callerCredentials.title")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {error ? <Alert>{error}</Alert> : null}
          {issuedCredential ? <SecretField label={t("admin.agent.issuedCredential")} value={issuedCredential} /> : null}
          <Button disabled={agent.status !== "active"} onClick={() => void issue()} type="button">{t("admin.agent.issueCredential")}</Button>
          {agent.credentials.length === 0 ? <Alert>{t("admin.agent.credentialsEmpty")}</Alert> : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>{t("field.credential_type")}</Th>
                    <Th>{t("field.hint")}</Th>
                    <Th>{t("field.status")}</Th>
                    <Th>{t("field.issuedAt")}</Th>
                    <Th>{t("resource.actionsColumn")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {agent.credentials.map((credential) => (
                    <tr key={credential.id}>
                      <Td>{credential.credential_type}</Td>
                      <Td><code>{credential.credential_hint}</code></Td>
                      <Td>{credential.status}</Td>
                      <Td>{new Date(credential.issued_at).toLocaleString()}</Td>
                      <Td>
                        <Button
                          disabled={credential.status !== "active"}
                          onClick={() => void revoke(credential.id)}
                          type="button"
                          variant="secondary"
                        >
                          {t("common.revoke")}
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="rounded-[28px]">
        <CardHeader><CardTitle>{t("admin.agent.graphTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="mb-3 text-sm font-medium text-slate-900">{t("admin.agent.runtimesTitle")}</div>
            {agent.runtimes.length === 0 ? <Alert>{t("admin.agent.runtimesEmpty")}</Alert> : (
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t("field.runtime_id")}</Th>
                      <Th>{t("field.type")}</Th>
                      <Th>{t("field.runtime_mode")}</Th>
                      <Th>{t("field.status")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {agent.runtimes.map((runtime) => (
                      <tr key={runtime.id}>
                        <Td><code>{runtime.runtime_id}</code></Td>
                        <Td>{runtime.runtime_type}</Td>
                        <Td>{runtime.runtime_mode}</Td>
                        <Td>{runtime.status}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
          <div>
            <div className="mb-3 text-sm font-medium text-slate-900">{t("admin.agent.connectionsTitle")}</div>
            {connections.length === 0 ? <Alert>{t("admin.agent.connectionsEmpty")}</Alert> : (
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t("field.connection_id")}</Th>
                      <Th>{t("field.target_resource")}</Th>
                      <Th>{t("field.grants")}</Th>
                      <Th>{t("field.status")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections.map((connection) => (
                      <tr key={connection.id}>
                        <Td><code>{connection.connection_id}</code></Td>
                        <Td>{connection.target_resource}</Td>
                        <Td>{connection.grant_count}</Td>
                        <Td>{connection.status}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
