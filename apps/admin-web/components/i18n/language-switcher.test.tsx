import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "./language-provider";
import { LanguageSwitcher } from "./language-switcher";

describe("LanguageSwitcher", () => {
  it("renders the active locale options", () => {
    render(
      <I18nProvider initialLocale="zh-CN">
        <LanguageSwitcher />
      </I18nProvider>,
    );

    expect(screen.getByLabelText("语言")).toBeInTheDocument();
    expect(screen.getByText("中文")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
  });
});
