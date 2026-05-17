import { describe, expect, it } from "vitest";
import { firstParam, getLoginNoticeKey, normalizeNextPath } from "./login-params";

describe("login params", () => {
  it("maps login reasons to i18n notice keys", () => {
    expect(getLoginNoticeKey("session-expired")).toBe("login.sessionExpired");
    expect(getLoginNoticeKey("session-required")).toBe("login.sessionRequired");
    expect(getLoginNoticeKey("other")).toBe("");
  });

  it("keeps only safe local next paths", () => {
    expect(normalizeNextPath("/target-resources")).toBe("/target-resources");
    expect(normalizeNextPath("https://evil.test")).toBe("/dashboard");
    expect(normalizeNextPath("//evil.test")).toBe("/dashboard");
    expect(normalizeNextPath()).toBe("/dashboard");
  });

  it("reads the first query value", () => {
    expect(firstParam(["/target-resources", "/users"])).toBe("/target-resources");
    expect(firstParam("/dashboard")).toBe("/dashboard");
  });
});
