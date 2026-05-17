import { describe, expect, it } from "vitest";
import { AdminApiError } from "./admin-client";
import { mapApiError } from "./errors";

describe("mapApiError", () => {
  it("maps stable admin auth errors to operator copy", () => {
    expect(mapApiError("invalid_admin_token")).toMatchObject({
      title: "Session expired"
    });
    expect(mapApiError("admin_forbidden")).toMatchObject({
      title: "Admin permission required"
    });
  });

  it("falls back for unknown errors", () => {
    expect(mapApiError("unknown")).toMatchObject({
      title: "Request failed"
    });
  });

  it("keeps admin API status and code for auth handling", () => {
    const error = new AdminApiError("Expired", 401, "invalid_admin_token");

    expect(error.status).toBe(401);
    expect(error.code).toBe("invalid_admin_token");
  });
});
