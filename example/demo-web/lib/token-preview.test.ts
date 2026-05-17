import { describe, expect, it } from "vitest";
import { previewToken } from "./token-preview";

describe("previewToken", () => {
  it("redacts long tokens", () => {
    expect(previewToken("abcdefghijklmnopqrstuvwxyz1234567890")).toBe("abcdefghijkl...34567890");
  });

  it("keeps empty values empty", () => {
    expect(previewToken()).toBe("");
  });
});
