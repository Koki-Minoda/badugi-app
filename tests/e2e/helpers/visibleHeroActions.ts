import type { Page } from "@playwright/test";

export async function visibleHeroActions(page: Page) {
  // Read one DOM snapshot: a phase change must not make isEnabled wait for a
  // button that disappeared between separate locator operations.
  return page.evaluate(() => {
    const ids = [
      "action-check",
      "action-call",
      "action-raise",
      "action-fold",
      "action-draw-selected",
    ];
    return ids.filter((id) => {
      const button = document.querySelector(`[data-testid="${id}"]`);
      if (!(button instanceof HTMLElement)) return false;
      const box = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return box.width > 0 && box.height > 0 && style.visibility !== "hidden"
        && style.visibility !== "collapse" && !button.matches(":disabled")
        && !button.closest('[aria-disabled="true"]');
    });
  });
}
