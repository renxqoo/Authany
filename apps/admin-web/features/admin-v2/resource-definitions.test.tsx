import { describe, expect, it } from "vitest";
import { resourceDefinitions, resourceOrder } from "./resource-definitions";

describe("resourceDefinitions", () => {
  it("registers all v2 management resources with list and detail structure", () => {
    expect(resourceOrder).toEqual([
      "applications",
      "agents",
      "runtimes",
      "target-resources",
      "target-connections",
      "access-grants",
      "audit-events",
      "keys"
    ]);

    for (const key of resourceOrder) {
      const definition = resourceDefinitions[key];
      expect(definition.path).toMatch(/^\//);
      expect(definition.endpoint.length).toBeGreaterThan(0);
      expect(definition.listColumns.length).toBeGreaterThan(0);
      expect(definition.detailSections.length).toBeGreaterThan(0);
      expect(definition.searchValues).toBeTypeOf("function");
    }
  });

  it("keeps destructive actions on every deletable resource", () => {
    expect(resourceDefinitions.applications.dangerAction?.label).toContain("Delete");
    expect(resourceDefinitions.agents.dangerAction?.label).toContain("Delete");
    expect(resourceDefinitions.runtimes.dangerAction?.method).toBe("PATCH");
    expect(resourceDefinitions["target-resources"].dangerAction?.method).toBe("PATCH");
    expect(resourceDefinitions["target-connections"].dangerAction?.method).toBe("PATCH");
    expect(resourceDefinitions["access-grants"].dangerAction?.method).toBe("PATCH");
    expect(resourceDefinitions.keys.detailActions?.map((action) => action.label)).toEqual(["Activate key", "Retire key"]);
  });

  it("shows signing key material as readable fields instead of raw metadata json", () => {
    const storedMaterial = resourceDefinitions.keys.detailSections.find((section) => section.title === "Stored Material");

    expect(storedMaterial?.fields.map((field) => field.label)).toEqual([
      "Encryption key ID",
      "Private key stored securely",
      "Public key (PEM)"
    ]);
    expect(storedMaterial?.fields.some((field) => field.key === "metadataJson")).toBe(false);
  });

  it("requires explicit target access policy fields instead of relying on backend defaults", () => {
    const targetResourceCreate = resourceDefinitions["target-resources"].createFields ?? [];
    const targetConnectionCreate = resourceDefinitions["target-connections"].createFields ?? [];
    const accessGrantCreate = resourceDefinitions["access-grants"].createFields ?? [];

    expect(targetResourceCreate.find((field) => field.name === "token_validation_mode")?.required).not.toBe(false);
    expect(targetConnectionCreate.find((field) => field.name === "external_context_mode")?.required).not.toBe(false);
    expect(targetConnectionCreate.find((field) => field.name === "max_token_ttl_seconds")?.required).not.toBe(false);
    expect(accessGrantCreate.find((field) => field.name === "grant_type")?.type).toBe("select");
    expect(accessGrantCreate.find((field) => field.name === "effect")?.type).toBe("select");
    expect(accessGrantCreate.find((field) => field.name === "expires_at")?.validate).toBeTypeOf("function");
  });

  it("hides fallback trust metadata until validation mode is explicitly configured", () => {
    const trustSection = resourceDefinitions["target-resources"].detailSections.find((section) => section.title === "Trust Setup");
    const trustField = trustSection?.fields.find((field) => field.label === "Trust metadata");
    const modeField = trustSection?.fields.find((field) => field.label === "Token validation mode");

    expect(modeField?.getValue?.({ tokenValidationMode: "" })).toBe("Not explicitly configured");
    expect(trustField?.getValue?.({
      trust_metadata: {
        issuer: "https://authany.test",
        token_validation_mode: "jwks"
      },
      tokenValidationMode: ""
    })).toEqual({
      configured: false,
      reason: "Trust metadata is hidden until token validation mode is explicitly configured and reviewed."
    });
  });
});
