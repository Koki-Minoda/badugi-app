import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FriendMatchSetupScreen from "../FriendMatchSetupScreen.jsx";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("FriendMatchSetupScreen", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders form fields, defaults Badugi, and shows placeholder on submit", () => {
    render(<FriendMatchSetupScreen />);

    const badugiRadio = screen.getByRole("radio", { name: /badugi/i });
    expect(badugiRadio).toHaveProperty("checked", true);

    expect(screen.getByLabelText(/seats/i)).toBeTruthy();
    expect(screen.getByLabelText(/small blind/i)).toBeTruthy();
    expect(screen.getByLabelText(/ante/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /create room/i }));
    expect(screen.getByText(/friend match lobbies are not implemented yet/i)).toBeTruthy();
  });

  it("allows switching variants", () => {
    render(<FriendMatchSetupScreen />);
    const nlhRadio = screen.getByRole("radio", { name: /no-limit hold'em/i });
    fireEvent.click(nlhRadio);
    expect(nlhRadio).toHaveProperty("checked", true);
    const badugiRadio = screen.getByRole("radio", { name: /badugi/i });
    expect(badugiRadio).toHaveProperty("checked", false);
  });

  it("navigates back to menu", () => {
    render(<FriendMatchSetupScreen />);
    fireEvent.click(screen.getByRole("button", { name: /back to menu/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/menu");
  });
});
