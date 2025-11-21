import sys
print("runner sys.executable:", sys.executable)

import argparse
from playwright.sync_api import sync_playwright

from .scenarios import (
    dealers_choice_smoke,
    hand_completion_flow,
    mixed_rotation_smoke,
    player_bust_flow,
    pro_rules_smoke,
    smoke_test,
    start_flow_smoke,
)

SCENARIOS = {
    "smoke": smoke_test,
    "start-flow": start_flow_smoke,
    "hand-completion": hand_completion_flow,
    "player-bust": player_bust_flow,
    "dealers-choice": dealers_choice_smoke,
    "mixed-rotation": mixed_rotation_smoke,
    "pro-rules": pro_rules_smoke,
}


def main():
    parser = argparse.ArgumentParser(description="Run scraping test scenarios")
    parser.add_argument("scenario", choices=SCENARIOS.keys(), help="Scenario to execute")
    args = parser.parse_args()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        SCENARIOS[args.scenario](page)
        browser.close()


if __name__ == "__main__":
    main()
