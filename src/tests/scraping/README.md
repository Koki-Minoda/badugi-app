# Scraping Tests

The scraping harness uses Playwright (Python) to smoke test the UI. Start the dev server (`npm run dev`) in another terminal, then run:

```bash
pip install -r tests/scraping/requirements.txt
playwright install chromium
python -m tests.scraping.runner smoke
```

Screenshots and logs are stored under `tests/scraping/logs/`.
