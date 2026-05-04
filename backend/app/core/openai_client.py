"""Thin OpenAI client for tournament feedback."""  # [tournament-feedback]
from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict

# [tournament-feedback] Constants for OpenAI generation endpoints.
OPENAI_CHAT_API_URL = "https://api.openai.com/v1/chat/completions"  # [tournament-feedback]
OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses"
DEFAULT_MODEL = "gpt-5.2"
DEFAULT_API_MODE = "responses"
FALLBACK_ADVICE = {  # [tournament-feedback]
    "adviceJa": "解析中にエラーが発生しました。もう一度プレイしてみましょう。",  # [tournament-feedback]
    "adviceEn": "An error occurred during analysis. Please try another tournament.",  # [tournament-feedback]
}  # [tournament-feedback]
FALLBACK_PLAY_FEEDBACK = {
    "adviceJa": (
        "セッション解析は受け付けました。APIキー未設定または一時的な解析失敗のため、"
        "今回は自動助言を返します。VPIP/PFR、ショーダウン率、オールイン頻度、"
        "split pot結果を確認し、次回は大きな損失が出た局面を中心に復習してください。"
    ),
    "adviceEn": (
        "Session feedback was accepted, but automated coaching used the fallback path. "
        "Review VPIP/PFR, showdown rate, all-in frequency, and split-pot outcomes."
    ),
}

logger = logging.getLogger(__name__)  # [tournament-feedback]


def _model_name() -> str:
    return os.getenv("MGX_OPENAI_MODEL") or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL


def _api_mode() -> str:
    return (os.getenv("MGX_OPENAI_API_MODE") or DEFAULT_API_MODE).strip().lower()


def _reasoning_effort() -> str:
    return (os.getenv("MGX_OPENAI_REASONING_EFFORT") or "low").strip().lower()


def _request_timeout(default: int) -> int:
    raw = os.getenv("MGX_OPENAI_TIMEOUT_SECONDS")
    if not raw:
        return default
    try:
        return max(5, min(120, int(raw)))
    except ValueError:
        return default


def _max_output_tokens() -> int:
    raw = os.getenv("MGX_OPENAI_MAX_OUTPUT_TOKENS")
    if not raw:
        return 1800
    try:
        return max(500, min(4000, int(raw)))
    except ValueError:
        return 1800


def _build_prompt(worst_spot: Dict[str, Any]) -> Dict[str, Any]:
    """Compose chat messages for the advisor model."""  # [tournament-feedback]

    summary_line = (  # [tournament-feedback]
        "以下がトーナメントで最も損失が大きかった局面です。Badugiのコーチとして分析してください。"  # [tournament-feedback]
    )
    return {  # [tournament-feedback]
        "model": _model_name(),
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


def _build_play_feedback_prompt(session_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Compose chat messages for multi-hand cash/tournament feedback."""

    return {
        "model": _model_name(),
        "temperature": 0.5,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an MGX mixed-game poker coach. Analyze a session summary from cash "
                    "or tournament play. Focus on actionable feedback, not generic encouragement. "
                    "Use the supplied VPIP/PFR, ROI or net chips, showdown/all-in/split-pot rates, "
                    "variant mix, and top issue list. Do not request personal information. "
                    "Respond as compact JSON with adviceJa and adviceEn. Both values must be plain "
                    "strings, not nested objects. Japanese should be natural and concise, with short "
                    "sections for 良かった点, 悪かった点, ROI/獲得チップへの仮説, and 次回の改善点. "
                    "Keep adviceJa under 900 Japanese characters and adviceEn under 350 English characters."
                ),
            },
            {
                "role": "user",
                "content": (
                    "30ハンド以上のセッションサマリです。良かった点、悪かった点、"
                    "ROI/獲得チップに影響した仮説、次回の具体方針を返してください。\n"
                    f"Session:\n{json.dumps(session_payload or {}, ensure_ascii=False)}"
                ),
            },
        ],
    }


def _parse_response(payload: Dict[str, Any]) -> Dict[str, str]:
    """Extract advice strings from OpenAI response."""  # [tournament-feedback]

    content = _extract_response_text(payload)

    content = _strip_json_fence((content or "").strip())
    if not content:
        return FALLBACK_ADVICE

    # Attempt to parse JSON response first.
    try:
        structured = json.loads(content)
        advice_ja = structured.get("adviceJa")
        advice_en = structured.get("adviceEn")
        if advice_ja is not None and advice_en is not None:
            return {
                "adviceJa": _stringify_advice(advice_ja).strip(),
                "adviceEn": _stringify_advice(advice_en).strip(),
            }
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


def _strip_json_fence(content: str) -> str:
    if not content.startswith("```"):
        return content
    lines = content.splitlines()
    if len(lines) >= 3 and lines[-1].strip() == "```":
        return "\n".join(lines[1:-1]).strip()
    return content.strip("`").strip()


def _stringify_advice(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(f"- {_stringify_advice(item)}" for item in value)
    if isinstance(value, dict):
        sections: list[str] = []
        for key, section_value in value.items():
            section_text = _stringify_advice(section_value)
            if section_text:
                sections.append(f"## {key}\n{section_text}")
        return "\n\n".join(sections)
    return str(value)


def _extract_response_text(payload: Dict[str, Any]) -> str:
    direct_text = payload.get("output_text")
    if isinstance(direct_text, str) and direct_text.strip():
        return direct_text.strip()

    try:
        content = payload["choices"][0]["message"]["content"]
        if isinstance(content, str):
            return content.strip()
    except (KeyError, IndexError, TypeError):
        pass

    output = payload.get("output")
    if isinstance(output, list):
        parts: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            for content_item in item.get("content") or []:
                if not isinstance(content_item, dict):
                    continue
                text = content_item.get("text")
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())
        if parts:
            return "\n".join(parts).strip()
    return ""


def _responses_payload_from_chat_payload(chat_payload: Dict[str, Any]) -> Dict[str, Any]:
    input_items = []
    for message in chat_payload.get("messages", []):
        role = message.get("role")
        content = message.get("content")
        if not role or not isinstance(content, str):
            continue
        input_items.append({
            "role": "developer" if role == "system" else role,
            "content": content,
        })
    payload: Dict[str, Any] = {
        "model": chat_payload.get("model") or _model_name(),
        "input": input_items,
        "max_output_tokens": _max_output_tokens(),
        "text": {
            "format": {
                "type": "json_schema",
                "name": "mgx_feedback_advice",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "adviceJa": {"type": "string"},
                        "adviceEn": {"type": "string"},
                    },
                    "required": ["adviceJa", "adviceEn"],
                },
                "strict": True,
            }
        },
    }
    effort = _reasoning_effort()
    if effort:
        payload["reasoning"] = {"effort": effort}
    return payload


def _call_openai(request_payload: Dict[str, Any], timeout: int) -> Dict[str, Any]:
    api_mode = _api_mode()
    if api_mode == "chat":
        url = OPENAI_CHAT_API_URL
        wire_payload = request_payload
    else:
        url = OPENAI_RESPONSES_API_URL
        wire_payload = _responses_payload_from_chat_payload(request_payload)

    request = urllib.request.Request(
        url,
        data=json.dumps(wire_payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {os.getenv('MGX_OPENAI_API_KEY') or os.getenv('OPENAI_API_KEY')}",
            "Content-Type": "application/json",
        },
    )
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw_body = response.read().decode("utf-8")
                return json.loads(raw_body)
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code not in {429, 502, 503, 504} or attempt == 2:
                raise
            time.sleep(0.5 * (attempt + 1))
        except urllib.error.URLError as exc:
            last_error = exc
            if attempt == 2:
                raise
            time.sleep(0.5 * (attempt + 1))
    if last_error:
        raise last_error
    return {}



def get_chatgpt_advice(worst_spot: Dict[str, Any]) -> Dict[str, str]:
    """Call OpenAI API and return structured advice."""  # [tournament-feedback]

    api_key = os.getenv("MGX_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("MGX_OPENAI_API_KEY/OPENAI_API_KEY is not set; returning fallback advice.")
        return FALLBACK_ADVICE

    try:
        parsed_body = _call_openai(_build_prompt(worst_spot or {}), timeout=_request_timeout(30))
        return _parse_response(parsed_body)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("OpenAI request failed: %s", exc)
    except Exception:  # pragma: no cover
        logger.exception("Unexpected error during OpenAI request.")
    return FALLBACK_ADVICE


def get_play_feedback_advice(session_payload: Dict[str, Any]) -> Dict[str, str]:
    """Call OpenAI API for session-level feedback and return structured advice."""

    api_key = os.getenv("MGX_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("MGX_OPENAI_API_KEY/OPENAI_API_KEY is not set; returning fallback play feedback.")
        return FALLBACK_PLAY_FEEDBACK

    try:
        parsed_body = _call_openai(
            _build_play_feedback_prompt(session_payload or {}),
            timeout=_request_timeout(60),
        )
        parsed = _parse_response(parsed_body)
        return parsed if parsed != FALLBACK_ADVICE else FALLBACK_PLAY_FEEDBACK
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("OpenAI play feedback request failed: %s", exc)
    except Exception:  # pragma: no cover
        logger.exception("Unexpected error during OpenAI play feedback request.")
    return FALLBACK_PLAY_FEEDBACK
