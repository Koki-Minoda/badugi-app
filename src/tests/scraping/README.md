# Scraping Tests

The scraping harness uses Playwright (Python) to smoke test the UI. Start the dev server (`npm run dev`) in another terminal, then run:

```bash
pip install -r tests/scraping/requirements.txt
playwright install chromium
python -m tests.scraping.runner smoke

# Dealer's Choice roulette smoke
python -m tests.scraping.runner dealers-choice

# Mixed rotation HUD + Pro rules warning
python -m tests.scraping.runner mixed-rotation
python -m tests.scraping.runner pro-rules
```

Screenshots and logs are stored under `tests/scraping/logs/`.
