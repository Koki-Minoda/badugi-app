"""Thin OpenAI client for tournament feedback."""  # [tournament-feedback]
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any, Dict

# [tournament-feedback] Constants for the OpenAI chat endpoint.
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"  # [tournament-feedback]
DEFAULT_MODEL = os.getenv("MGX_OPENAI_MODEL", "gpt-4.1-mini")  # [tournament-feedback]
FALLBACK_ADVICE = {  # [tournament-feedback]
    "adviceJa": "解析中にエラーが発生しました。もう一度プレイしてみましょう。",  # [tournament-feedback]
    "adviceEn": "An error occurred during analysis. Please try another tournament.",  # [tournament-feedback]
}  # [tournament-feedback]

logger = logging.getLogger(__name__)  # [tournament-feedback]


def _build_prompt(worst_spot: Dict[str, Any]) -> Dict[str, Any]:
    """Compose chat messages for the advisor model."""  # [tournament-feedback]

    summary_line = (  # [tournament-feedback]
        "以下がトーナメントで最も損失が大きかった局面です。Badugiのコーチとして分析してください。"  # [tournament-feedback]
    )
    return {  # [tournament-feedback]
        "model": DEFAULT_MODEL,
        "temperature": 0.6,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a professional Badugi tournament coach. "
                    "Given the player's worst-loss scenario from a tournament, "
                    "analyze WHY the mistake happened and HOW they should improve. "
                    "Your output must be in Japanese (adviceJa) and include a short English summary (adviceEn). "
                    "Provide: mistake summary, why it was bad, how to fix it. "
                    "Keep the language simple and actionable. Avoid solver jargon. "
                    "Respond as JSON with keys adviceJa and adviceEn."
                ),
            },
            {
                "role": "user",
                "content": f"{summary_line}\nWorstSpot:\n{json.dumps(worst_spot or {}, ensure_ascii=False)}",
            },
        ],
    }


def _parse_response(payload: Dict[str, Any]) -> Dict[str, str]:
    """Extract advice strings from OpenAI response."""  # [tournament-feedback]

    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return FALLBACK_ADVICE

    content = (content or "").strip()
    if not content:
        return FALLBACK_ADVICE

    # Attempt to parse JSON response first.
    try:
        structured = json.loads(content)
        advice_ja = structured.get("adviceJa")
        advice_en = structured.get("adviceEn")
        if isinstance(advice_ja, str) and isinstance(advice_en, str):
            return {"adviceJa": advice_ja.strip(), "adviceEn": advice_en.strip()}
    except json.JSONDecodeError:
        pass

    # Fallback: split raw content into two sections heuristically.
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        return FALLBACK_ADVICE
    advice_ja = "\n".join(lines)
    advice_en = lines[-1] if lines else ""
    return {
        "adviceJa": advice_ja,
        "adviceEn": advice_en,
    }


def get_chatgpt_advice(worst_spot: Dict[str, Any]) -> Dict[str, str]:
    """Call OpenAI API and return structured advice."""  # [tournament-feedback]

    api_key = os.getenv("MGX_OPENAI_API_KEY")
    if not api_key:
        logger.warning("MGX_OPENAI_API_KEY is not set; returning fallback advice.")
        return FALLBACK_ADVICE

    request_payload = _build_prompt(worst_spot or {})
    request_data = json.dumps(request_payload).encode("utf-8")
    request = urllib.request.Request(
        OPENAI_API_URL,
        data=request_data,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw_body = response.read().decode("utf-8")
            parsed_body = json.loads(raw_body)
            return _parse_response(parsed_body)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("OpenAI request failed: %s", exc)
    except Exception:  # pragma: no cover
        logger.exception("Unexpected error during OpenAI request.")
    return FALLBACK_ADVICE
