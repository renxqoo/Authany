import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResourceFormDialog } from "./resource-form-dialog";
import * as resourceClient from "./resource-client";

describe("ResourceFormDialog", () => {
  it("builds structured payloads for complex field types", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn(async () => undefined);

    render(
      <ResourceFormDialog
        fields={[
          { name: "name", label: "Name" },
          { name: "redirect_uris", label: "Redirect URIs", type: "string-array" },
          { name: "constraints", label: "Constraints", type: "json", required: false },
          { name: "enabled", label: "Enabled", type: "boolean", required: false, placeholder: "Enable this resource" },
          { name: "expires_at", label: "Expires at", type: "datetime-local", required: false }
        ]}
        mode="create"
        onClose={onClose}
        onSubmit={onSubmit}
        title="Create resource"
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Demo Resource" } });
    fireEvent.change(screen.getByLabelText("Redirect URIs"), { target: { value: "https://one.test/callback\nhttps://two.test/callback" } });
    fireEvent.change(screen.getByLabelText("Constraints"), { target: { value: "{\"env\":\"prod\"}" } });
    fireEvent.click(screen.getByLabelText("Enable this resource"));
    fireEvent.change(screen.getByLabelText("Expires at"), { target: { value: "2026-05-17T09:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      constraints: { env: "prod" },
      enabled: true,
      expires_at: "2026-05-17T01:30:00.000Z",
      name: "Demo Resource",
      redirect_uris: ["https://one.test/callback", "https://two.test/callback"]
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("omits blank optional json and string-array fields instead of inventing defaults", async () => {
    const onSubmit = vi.fn(async () => undefined);

    render(
      <ResourceFormDialog
        fields={[
          { name: "name", label: "Name" },
          { name: "constraints", label: "Constraints", type: "json", required: false },
          { name: "allowed_context_providers", label: "Allowed context providers", type: "string-array", required: false }
        ]}
        mode="create"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        title="Create resource"
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Demo Resource" } });
    fireEvent.change(screen.getByLabelText("Constraints"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Allowed context providers"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      allowed_context_providers: undefined,
      constraints: undefined,
      name: "Demo Resource"
    });
  });

  it("blocks required structured fields when blank", async () => {
    const onSubmit = vi.fn(async () => undefined);

    render(
      <ResourceFormDialog
        fields={[
          { name: "name", label: "Name" },
          { name: "redirect_uris", label: "Redirect URIs", type: "string-array" }
        ]}
        mode="create"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        title="Create resource"
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Demo Resource" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Redirect URIs is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("switches dependent principal fields and only submits visible values", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const loadRemoteOptions = vi.spyOn(resourceClient, "loadRemoteOptions");
    loadRemoteOptions.mockImplementation(async (source, queryValue) => {
      if (source.endpoint === "applications") {
        return [{ label: "Admin Web / authany-admin-web", value: "authany-admin-web" }];
      }
      if (source.endpoint === "agents") {
        return [{ label: "Demo Agent / agt_demo", value: "agt_demo" }];
      }
      if (source.endpoint === "runtimes" && queryValue === "agt_demo") {
        return [{ label: "rt_demo / edge", value: "rt_demo" }];
      }
      if (source.endpoint === "target-resources") {
        return [{ label: "Demo Target / demo-target", value: "demo-target" }];
      }
      return [];
    });

    render(
      <ResourceFormDialog
        fields={[
          {
            name: "principal_type",
            label: "Principal type",
            type: "select",
            options: [
              { label: "Agent", value: "agent" },
              { label: "Application", value: "application" }
            ]
          },
          {
            name: "principal_id",
            label: "Application ID",
            type: "select",
            dependsOn: { field: "principal_type", values: ["application"] },
            optionSource: { endpoint: "applications", valueKey: "app_id" }
          },
          {
            name: "principal_id",
            label: "Agent ID",
            type: "select",
            dependsOn: { field: "principal_type", values: ["agent"] },
            optionSource: { endpoint: "agents", valueKey: "agent_id" }
          },
          {
            name: "runtime_id",
            label: "Runtime ID",
            type: "select",
            required: false,
            dependsOn: { field: "principal_type", values: ["agent"] },
            optionSource: { endpoint: "runtimes", valueKey: "runtimeId", queryParamField: "agent_id", queryValueField: "principal_id" }
          },
          {
            name: "target_resource",
            label: "Target resource",
            type: "select",
            optionSource: { endpoint: "target-resources", valueKey: "targetResourceCode" }
          }
        ]}
        mode="create"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        title="Create target connection"
      />,
    );

    fireEvent.change(screen.getByLabelText("Principal type"), { target: { value: "application" } });
    expect(await screen.findByLabelText("Application ID")).toBeInTheDocument();
    expect(screen.queryByLabelText("Agent ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Runtime ID")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Application ID"), { target: { value: "authany-admin-web" } });

    fireEvent.change(screen.getByLabelText("Principal type"), { target: { value: "agent" } });
    expect(await screen.findByLabelText("Agent ID")).toBeInTheDocument();
    expect(screen.queryByLabelText("Application ID")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Runtime ID")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Agent ID"), { target: { value: "agt_demo" } });
    await waitFor(() =>
      expect(loadRemoteOptions).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: "runtimes", queryParamField: "agent_id", queryValueField: "principal_id" }),
        "agt_demo",
      ),
    );
    fireEvent.change(screen.getByLabelText("Runtime ID"), { target: { value: "rt_demo" } });
    fireEvent.change(screen.getByLabelText("Target resource"), { target: { value: "demo-target" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      principal_id: "agt_demo",
      principal_type: "agent",
      runtime_id: "rt_demo",
      target_resource: "demo-target"
    });

    loadRemoteOptions.mockRestore();
  });

  it("hides Runtime ID input when creating runtimes", () => {
    render(
      <ResourceFormDialog
        fields={[
          {
            name: "agent_id",
            label: "Owning agent",
            type: "select",
            optionSource: { endpoint: "agents", valueKey: "agent_id" }
          },
          { name: "runtime_type", label: "Runtime type" },
          {
            name: "runtime_mode",
            label: "Runtime mode",
            type: "select",
            options: [{ label: "Stateless", value: "stateless" }]
          }
        ]}
        mode="create"
        onClose={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
        title="Create runtime"
      />,
    );

    expect(screen.queryByLabelText("Runtime ID")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Owning agent")).toBeInTheDocument();
  });

  it("blocks custom validation failures for explicit expiry requirements", async () => {
    const onSubmit = vi.fn(async () => undefined);

    render(
      <ResourceFormDialog
        fields={[
          { name: "connection_id", label: "Target connection" },
          {
            name: "expires_at",
            label: "Expires at",
            type: "datetime-local",
            validate: (value) => String(value ?? "").trim() ? undefined : "Expires at is required."
          }
        ]}
        mode="create"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        title="Create access grant"
      />,
    );

    fireEvent.change(screen.getByLabelText("Target connection"), { target: { value: "tc_demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Expires at is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
