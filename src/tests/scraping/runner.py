import argparse
from playwright.sync_api import sync_playwright

from .scenarios import smoke_test

SCENARIOS = {
    "smoke": smoke_test,
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
