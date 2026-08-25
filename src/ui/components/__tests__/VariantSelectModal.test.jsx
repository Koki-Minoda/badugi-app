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
    window.localStorage.clear();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("renders variants, focuses dialog, and handles selection", () => {
    window.localStorage.setItem("mgx.previewVariants", "true");
    const handleSelect = vi.fn();
    const handleClose = vi.fn();
    render(
      <VariantSelectModal isOpen onClose={handleClose} onSelectVariant={handleSelect} />,
    );

    const dialog = screen.getByRole("dialog", { name: /select a variant/i });
    expect(dialog).toBeTruthy();

    const badugiButton = screen
      .getAllByRole("button", { name: /badugi/i })
      .find((button) => button.textContent?.includes("Badugi") && !button.textContent?.includes("Single Draw"));
    expect(badugiButton).toBeDefined();
    fireEvent.click(badugiButton);
    expect(handleSelect).toHaveBeenCalledWith("badugi");
    expect(handleClose).toHaveBeenCalled();
  });

  it("allows draw lowball variants to be selected", () => {
    window.localStorage.setItem("mgx.previewVariants", "true");
    const handleSelect = vi.fn();
    render(<VariantSelectModal isOpen onClose={() => {}} onSelectVariant={handleSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /2-7 triple draw/i }));
    expect(handleSelect).toHaveBeenCalledWith("D01");

    fireEvent.click(screen.getByRole("button", { name: /a-5 triple draw/i }));
    expect(handleSelect).toHaveBeenCalledWith("D02");

    fireEvent.click(screen.getByRole("button", { name: /2-7 single draw/i }));
    expect(handleSelect).toHaveBeenCalledWith("S01");

    fireEvent.click(screen.getByRole("button", { name: /a-5 single draw/i }));
    expect(handleSelect).toHaveBeenCalledWith("S02");
  });

  it("allows Omaha family variants to be selected", () => {
    window.localStorage.setItem("mgx.previewVariants", "true");
    const handleSelect = vi.fn();
    render(<VariantSelectModal isOpen onClose={() => {}} onSelectVariant={handleSelect} />);

    const ploButton = screen.getByRole("button", { name: /pot-limit omaha/i });
    expect(ploButton.disabled).toBe(false);
    fireEvent.click(ploButton);
    expect(handleSelect).toHaveBeenCalledWith("plo");

    fireEvent.click(screen.getByRole("button", { name: /big-o/i }));
    expect(handleSelect).toHaveBeenCalledWith("big_o");

    fireEvent.click(screen.getByRole("button", { name: /5-card plo/i }));
    expect(handleSelect).toHaveBeenCalledWith("five_card_plo");
  });

  it("allows Dramaha family variants to be selected", () => {
    window.localStorage.setItem("mgx.previewVariants", "true");
    const handleSelect = vi.fn();
    render(<VariantSelectModal isOpen onClose={() => {}} onSelectVariant={handleSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /^dramaha hi\b/i }));
    expect(handleSelect).toHaveBeenCalledWith("dramaha_hi");

    fireEvent.click(screen.getByRole("button", { name: /dramaha 2-7/i }));
    expect(handleSelect).toHaveBeenCalledWith("dramaha_27");

    fireEvent.click(screen.getByRole("button", { name: /dramaha badugi/i }));
    expect(handleSelect).toHaveBeenCalledWith("dramaha_badugi");
  });

  it("does not render when closed", () => {
    render(<VariantSelectModal isOpen={false} onClose={() => {}} onSelectVariant={() => {}} />);
    expect(screen.queryByText(/select a variant/i)).toBeNull();
  });

  it("blocks preview variants when the preview flag is off", () => {
    const handleSelect = vi.fn();
    render(<VariantSelectModal isOpen onClose={() => {}} onSelectVariant={handleSelect} />);

    const previewButton = screen
      .getAllByRole("button", { name: /badeucey td/i })
      .find((button) => button.textContent?.includes("Badeucey TD"));
    expect(previewButton.disabled).toBe(true);
    fireEvent.click(previewButton);
    expect(handleSelect).not.toHaveBeenCalled();

    const a5Button = screen.getByRole("button", { name: /a-5 single draw/i });
    expect(a5Button.disabled).toBe(false);
    fireEvent.click(a5Button);
    expect(handleSelect).toHaveBeenCalledWith("S02");
  });

  it("closes when escape is pressed", () => {
    const handleClose = vi.fn();
    render(<VariantSelectModal isOpen onClose={handleClose} onSelectVariant={() => {}} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalled();
  });
});
