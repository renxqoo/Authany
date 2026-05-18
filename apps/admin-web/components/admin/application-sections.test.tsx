import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n/language-provider";
import { ApplicationSecretSection } from "./application-sections";

vi.mock("@/lib/admin/application-api", () => ({
  revealApplicationSecret: vi.fn(async () => ({ app_secret: "sk_live_existing_secret" })),
  rotateApplicationSecret: vi.fn(async () => ({
    app_secret: "sk_live_rotated_secret",
    hint: "sk_live...cret",
    secret_id: "secret_rotated"
  }))
}));

describe("ApplicationSecretSection", () => {
  it("shows the rotated secret once instead of duplicating it as active secret", async () => {
    const refresh = vi.fn(async () => undefined);

    render(
      <I18nProvider initialLocale="en">
        <ApplicationSecretSection
          app={{
            app_id: "demo-web",
            id: "app_1",
            secrets: [
              {
                created_at: "2026-05-17T10:00:00.000Z",
                hint: "sk_live...cret",
                id: "secret_active",
                revealable: true,
                status: "active"
              }
            ]
          }}
          refresh={refresh}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rotate secret" }));

    await waitFor(() => expect(screen.getByText("New Active App Secret")).toBeInTheDocument());
    expect(screen.queryByText("Active secret (sk_live...cret)")).not.toBeInTheDocument();
    expect(
      screen.getByText("This newly rotated secret is now the active secret. Store it now because the UI will not show the same value twice."),
    ).toBeInTheDocument();
  });
});
