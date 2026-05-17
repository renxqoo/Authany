import { describe, expect, it } from "vitest";
import { resolveRequestOrigin } from "./request-origin";

describe("resolveRequestOrigin", () => {
  it("uses the real Host header instead of the framework-normalized URL origin", () => {
    const origin = resolveRequestOrigin({
      headers: new Headers({ host: "127.0.0.1:5173" }),
      url: "http://localhost:5173/api/demo/login"
    });

    expect(origin).toBe("http://127.0.0.1:5173");
  });

  it("honors forwarded host and protocol behind a proxy", () => {
    const origin = resolveRequestOrigin({
      headers: new Headers({
        "x-forwarded-host": "demo.authany.test",
        "x-forwarded-proto": "https"
      }),
      url: "http://127.0.0.1:5173/api/demo/login"
    });

    expect(origin).toBe("https://demo.authany.test");
  });
});
