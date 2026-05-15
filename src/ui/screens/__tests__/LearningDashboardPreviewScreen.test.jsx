import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LearningDashboardPreviewScreen from "../LearningDashboardPreviewScreen.jsx";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: "/learning-dashboard-preview" }),
  };
});

describe("LearningDashboardPreviewScreen", () => {
  afterEach(() => {
    cleanup();
    mockNavigate.mockClear();
  });

  it("renders preview dashboard and keeps clear state local", () => {
    render(<LearningDashboardPreviewScreen locale="en" />);
    expect(screen.getByTestId("learning-dashboard-preview-screen")).toBeTruthy();
    expect(screen.getByTestId("learning-dashboard-preview")).toBeTruthy();
    fireEvent.click(screen.getByTestId("learning-dashboard-clear"));
    expect(screen.getByTestId("learning-dashboard-empty")).toBeTruthy();
  });

  it("preserves preview query when returning to menu", () => {
    render(<LearningDashboardPreviewScreen locale="en" />);
    fireEvent.click(screen.getByTestId("learning-dashboard-preview-back"));
    expect(mockNavigate).toHaveBeenCalledWith("/menu?mgxPreview=coaching");
  });
});
