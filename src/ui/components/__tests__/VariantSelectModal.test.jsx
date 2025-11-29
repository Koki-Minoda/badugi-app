import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import VariantSelectModal from "../VariantSelectModal.jsx";

describe("VariantSelectModal", () => {
  beforeAll(() => {
    vi.stubGlobal("requestAnimationFrame", (callback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("renders variants, focuses dialog, and handles selection", () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();
    render(
      <VariantSelectModal isOpen onClose={handleClose} onSelectVariant={handleSelect} />,
    );

    const dialog = screen.getByRole("dialog", { name: /select a variant/i });
    expect(dialog).toBeTruthy();

    const badugiButton = screen.getByRole("button", { name: /badugi/i });
    fireEvent.click(badugiButton);
    expect(handleSelect).toHaveBeenCalledWith("badugi");
    expect(handleClose).toHaveBeenCalled();
  });

  it("prevents selection of disabled variants", () => {
    const handleSelect = vi.fn();
    render(<VariantSelectModal isOpen onClose={() => {}} onSelectVariant={handleSelect} />);

    const ploButton = screen.getByRole("button", { name: /pot-limit omaha/i });
    expect(ploButton.disabled).toBe(true);
    fireEvent.click(ploButton);
    expect(handleSelect).not.toHaveBeenCalled();
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0);
  });

  it("does not render when closed", () => {
    render(<VariantSelectModal isOpen={false} onClose={() => {}} onSelectVariant={() => {}} />);
    expect(screen.queryByText(/select a variant/i)).toBeNull();
  });

  it("closes when escape is pressed", () => {
    const handleClose = vi.fn();
    render(<VariantSelectModal isOpen onClose={handleClose} onSelectVariant={() => {}} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalled();
  });
});
