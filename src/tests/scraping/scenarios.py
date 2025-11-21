import re

from playwright.sync_api import Page, expect

from .config import CONFIG
from .selectors import START_BUTTON, TITLE_SELECTOR


def _wait_ms():
    return CONFIG.wait_timeout * 1000


def _goto(page: Page, path: str) -> None:
    base_url = CONFIG.base_url.rstrip("/")
    page.goto(f"{base_url}{path}", wait_until="domcontentloaded")


def start_flow_smoke(page: Page) -> None:
    _goto(page, "/")
    heading = page.get_by_role("heading", name=re.compile("badugi", re.IGNORECASE))
    expect(heading).to_be_visible(timeout=_wait_ms())

    start_button = page.get_by_role("button", name=re.compile("start", re.IGNORECASE))
    expect(start_button).to_be_enabled(timeout=_wait_ms())
    start_button.click()

    page.wait_for_url("**/game*", timeout=_wait_ms())
    stack_nodes = page.locator("text=Stack")
    expect(stack_nodes).to_have_count(4, timeout=_wait_ms())

    action_button = page.get_by_role("button", name=re.compile("call|check|raise|fold", re.IGNORECASE))
    expect(action_button).to_be_visible(timeout=_wait_ms())

    page.screenshot(path=str(CONFIG.screenshot_dir / "start-flow.png"))


def hand_completion_flow(page: Page) -> None:
    _goto(page, "/game")
    action_button = page.get_by_role("button", name=re.compile("call|check|raise|fold", re.IGNORECASE))
    expect(action_button).to_be_visible(timeout=_wait_ms() * 2)

    stacks = page.locator("text=Stack")
    expect(stacks).to_have_count(4, timeout=_wait_ms())

    action_button.click()
    page.wait_for_timeout(500)

    draw_button = page.get_by_role("button", name=re.compile("draw|stand pat", re.IGNORECASE))
    expect(draw_button).to_be_visible(timeout=_wait_ms())
    draw_button.click()

    confirm_button = page.get_by_role("button", name=re.compile("confirm|finish draw", re.IGNORECASE))
    if confirm_button.count():
        confirm_button.click()

    showdown_heading = page.get_by_role("heading", name=re.compile("showdown", re.IGNORECASE))
    expect(showdown_heading).to_be_visible(timeout=_wait_ms() * 3)

    winner_badge = page.get_by_text(re.compile("winner", re.IGNORECASE))
    expect(winner_badge).to_be_visible(timeout=_wait_ms())

    pot_info = page.get_by_text(re.compile("pot", re.IGNORECASE))
    expect(pot_info).to_be_visible(timeout=_wait_ms())

    next_hand = page.get_by_role("button", name=re.compile("next hand", re.IGNORECASE))
    expect(next_hand).to_be_visible(timeout=_wait_ms() * 3)
    next_hand.click()

    hero_stack = page.get_by_text(re.compile("stack", re.IGNORECASE)).first
    expect(hero_stack).to_contain_text(re.compile(r"\d+"), timeout=_wait_ms())

    page.screenshot(path=str(CONFIG.screenshot_dir / "hand-completion.png"))


def player_bust_flow(page: Page) -> None:
    _goto(page, "/game")
    page.wait_for_timeout(500)
    page.evaluate("window.__BADUGI_E2E__?.simulateBust?.(3)")

    busted_badge = page.get_by_text(re.compile("busted", re.IGNORECASE))
    expect(busted_badge).to_be_visible(timeout=_wait_ms())

    stack_zero = page.get_by_text(re.compile(r"Stack\\s+0"), exact=False)
    expect(stack_zero).to_be_visible(timeout=_wait_ms())

    action_button = page.get_by_role("button", name=re.compile("call|check|raise|fold", re.IGNORECASE))
    expect(action_button).to_be_visible(timeout=_wait_ms())

    page.screenshot(path=str(CONFIG.screenshot_dir / "player-bust.png"))


def _unlock_progress(page: Page) -> None:
    _goto(page, "/")
    page.evaluate(
        """() => {
            window.localStorage.setItem(
                "playerProgress",
                JSON.stringify({
                    worldChampCleared: true,
                    stageWins: { store: 1, local: 1, national: 1, world: 1 }
                })
            );
        }"""
    )


def smoke_test(page: Page) -> None:
    _goto(page, "/")
    expect(page.locator(TITLE_SELECTOR)).to_be_visible(timeout=_wait_ms())
    if page.locator(START_BUTTON).is_visible():
        page.locator(START_BUTTON).click()
        page.wait_for_timeout(1000)
        page.screenshot(path=str(CONFIG.screenshot_dir / "smoke.png"))


def dealers_choice_smoke(page: Page) -> None:
    _goto(page, "/dealers-choice")

    spin_button = page.get_by_test_id("roulette-spin")
    expect(spin_button).to_be_enabled(timeout=_wait_ms())
    spin_button.click()
    page.wait_for_timeout(2200)

    launch_button = page.get_by_test_id("roulette-launch")
    expect(launch_button).to_be_enabled(timeout=_wait_ms())
    launch_button.click()

    page.wait_for_url("**/game?*", timeout=_wait_ms())

    hud = page.get_by_test_id("dealers-choice-hud")
    expect(hud).to_be_visible(timeout=_wait_ms())

    fold_button = page.get_by_role("button", name="Fold")
    expect(fold_button).to_be_visible(timeout=_wait_ms() * 2)
    fold_button.click()

    next_button = page.get_by_role("button", name="Next Hand")
    expect(next_button).to_be_visible(timeout=_wait_ms() * 3)
    next_button.click()

    expect(hud).to_be_visible(timeout=_wait_ms())

    _goto(page, "/dealers-choice")
    clear_button = page.get_by_test_id("roulette-clear")
    expect(clear_button).to_be_enabled(timeout=_wait_ms())
    clear_button.click()

    _goto(page, "/game")
    expect(page.get_by_test_id("dealers-choice-hud")).to_be_hidden(timeout=_wait_ms())

    page.screenshot(path=str(CONFIG.screenshot_dir / "dealers-choice.png"))


def mixed_rotation_smoke(page: Page) -> None:
    _unlock_progress(page)
    _goto(page, "/mixed?preset=mix-horse-pro")
    start_button = page.get_by_role("button", name="Mixed Game 開始")
    expect(start_button).to_be_enabled(timeout=_wait_ms())
    start_button.click()
    page.wait_for_url("**/game*", timeout=_wait_ms())

    hud = page.get_by_test_id("mixed-hud")
    expect(hud).to_be_visible(timeout=_wait_ms())
    next_label = hud.locator('[data-testid="mixed-next-label"]')
    initial_text = next_label.inner_text()

    page.evaluate("window.__BADUGI_E2E__?.rotateMixed?.()")
    expect.poll(lambda: next_label.inner_text()).not_to_equal(initial_text)

    page.screenshot(path=str(CONFIG.screenshot_dir / "mixed-rotation.png"))


def pro_rules_smoke(page: Page) -> None:
    _goto(page, "/game?game=B01")
    page.wait_for_timeout(500)

    page.evaluate(
        "window.__BADUGI_E2E__?.setKillState?.({ pending: { multiplier: 3 } })"
    )
    notice = page.get_by_test_id("pro-rule-notice")
    expect(notice).to_be_visible(timeout=_wait_ms())
    expect(notice).to_contain_text("キルブラインド")

    page.evaluate(
        "window.__BADUGI_E2E__?.setRuleWarningsFromTest?.(['宣言フェーズが必要'])"
    )
    expect(notice).to_contain_text("宣言")

    page.screenshot(path=str(CONFIG.screenshot_dir / "pro-rules.png"))
