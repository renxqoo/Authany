import { describe, expect, it, vi } from "vitest";
import { loadRemoteOptions } from "./resource-client";

describe("loadRemoteOptions", () => {
  it("filters rows using exact match constraints", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ([
        { displayName: "Inactive target", status: "inactive", targetResourceCode: "inactive-target" },
        { displayName: "Active target", status: "active", targetResourceCode: "active-target" }
      ])
    }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(loadRemoteOptions({
      endpoint: "target-resources",
      valueKey: "targetResourceCode",
      labelKeys: ["displayName", "targetResourceCode"],
      match: { status: "active" }
    })).resolves.toEqual([
      { label: "Active target / active-target", value: "active-target" }
    ]);
  });
});
