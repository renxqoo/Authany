import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n/language-provider";
import { SecretField } from "./secret-field";

describe("SecretField", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => undefined) }
    });
  });

  it("keeps secrets hidden until reveal and allows copying", async () => {
    renderWithI18n(<SecretField label="App Secret" onReveal={async () => "sk_secret_value"} />);

    expect(screen.getByText("••••••••••••••••••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    expect(await screen.findByText("sk_secret_value")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("sk_secret_value"));
  });

  it("disables copying again after the visible secret is hidden", async () => {
    renderWithI18n(<SecretField label="App Secret" value="sk_existing_value" />);

    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    expect(screen.getByRole("button", { name: "Copy" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));

    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled();
  });
});

function renderWithI18n(node: React.ReactNode) {
  return render(<I18nProvider initialLocale="en">{node}</I18nProvider>);
}
