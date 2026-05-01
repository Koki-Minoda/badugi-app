import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProfileStats from "../ProfileStats.jsx";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("ProfileStats", () => {
  afterEach(() => {
    cleanup();
    mockNavigate.mockClear();
  });

  it("offers a direct return to game select", () => {
    render(<ProfileStats />);

    fireEvent.click(screen.getByRole("button", { name: "ゲーム選択へ戻る" }));

    expect(mockNavigate).toHaveBeenCalledWith("/menu");
  });
});
