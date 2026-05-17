import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the demo-web client identity", () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      json: async () => ({ authenticated: false })
    })));

    render(<HomePage />);

    expect(screen.getByText("Business app using demo-web")).toBeInTheDocument();
    expect(screen.getByText(/Hosted application login/)).toBeInTheDocument();
    expect(screen.getByText(/No demo-web session yet/)).toBeInTheDocument();
  });
});
