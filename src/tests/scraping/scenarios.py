from playwright.sync_api import Page, expect

from .config import CONFIG
from .selectors import START_BUTTON, TITLE_SELECTOR

def smoke_test(page: Page) -> None:
    page.goto(CONFIG.base_url, wait_until="domcontentloaded")
    expect(page.locator(TITLE_SELECTOR)).to_be_visible(timeout=CONFIG.wait_timeout * 1000)
    if page.locator(START_BUTTON).is_visible():
        page.locator(START_BUTTON).click()
        page.wait_for_timeout(1000)
        page.screenshot(path=str(CONFIG.screenshot_dir / "smoke.png"))
