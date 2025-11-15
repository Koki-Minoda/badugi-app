from dataclasses import dataclass
from pathlib import Path

@dataclass
class ScrapingConfig:
    base_url: str = "http://localhost:5173"
    screenshot_dir: Path = Path("tests/scraping/logs/screenshots")
    wait_timeout: float = 5.0

CONFIG = ScrapingConfig()
CONFIG.screenshot_dir.mkdir(parents=True, exist_ok=True)
