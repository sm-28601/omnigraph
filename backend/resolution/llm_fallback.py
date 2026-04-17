from __future__ import annotations

import os
from typing import Any

import requests


def resolve_with_llm(record: dict[str, Any], candidates: list[dict[str, Any]]) -> tuple[str | None, float]:
    """
    Optional Tier-3 LLM resolver for ambiguous records.
    Expects OPENAI_API_KEY and optionally OPENAI_BASE_URL / OPENAI_MODEL.
    Returns (entity_id, confidence), or (None, 0.0) if no decision.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not candidates:
        return None, 0.0

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    candidate_text = "\n".join(
        f"- {c['entity_id']}: {c['name']} | {c['address']} | {c['city']}, {c['state']} | PAN={c['pan']}" for c in candidates
    )
    prompt = (
        "You are an entity-resolution assistant.\n"
        "Given one ambiguous business record and a list of candidate entities, pick the best match entity_id.\n"
        "If no candidate should match, return NONE.\n"
        "Respond strictly as JSON object: {\"entity_id\":\"...|NONE\",\"confidence\":0.0-1.0}.\n\n"
        f"Record:\n{record}\n\nCandidates:\n{candidate_text}\n"
    )

    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
            },
            timeout=20,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
    except Exception:
        return None, 0.0

    # Small tolerant extraction for common response formats.
    if "NONE" in content.upper():
        return None, 0.0

    picked = None
    for c in candidates:
        if c["entity_id"] in content:
            picked = c["entity_id"]
            break
    if not picked:
        return None, 0.0
    return picked, 0.8
