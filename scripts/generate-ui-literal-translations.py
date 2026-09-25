#!/usr/bin/env python3
"""Classify Portuguese static UI literals and produce a reviewed EN mapping.

The model receives only source literals extracted from the local frontend. It must
exclude regulatory text and user/domain content so the runtime bridge never
translates submitted evidence, identifiers or document contents.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from openai import OpenAI

source_path = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ui-literals.json")
output_path = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/ui-literal-translation-review.json")
items = json.loads(source_path.read_text())

schema = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "source": {"type": "string"},
                    "classification": {"type": "string", "enum": ["translate", "ignore"]},
                    "english": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["source", "classification", "english", "reason"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["items"],
    "additionalProperties": False,
}

instructions = """You are producing a production translation dictionary for a Portuguese environmental governance web application.

For EACH supplied source literal, return exactly one item. Classify as `translate` ONLY if it is a static user-interface label, heading, help text, button, status, empty-state, placeholder, chart label, or fixed navigation copy. Provide clear British English that preserves regulatory acronyms (DCAPE, RDCD, MIRR, PUE, WUE, CUE, e-GAR, BMS, SIN01) and all numbers/units.

Classify as `ignore` if it is any of: user-entered or API-supplied content; personal/company/project/file names; a legal or regulatory source quotation; a measure/requirement description; an audit/event log; a raw status/code/identifier; a partial sentence fragment which cannot safely be translated alone; or content intentionally written in Portuguese as a source record. For ignored literals, set english to an empty string.

Do not invent legal obligations or edit content semantics. Never return Portuguese in an english field. Treat text inside quotes as UI copy only when it is a platform quote/tagline, otherwise ignore it. Return one output item per input, in the same order.

Input items:
"""

client = OpenAI()
translated_items: list[dict] = []
batch_size = 80
for start in range(0, len(items), batch_size):
    batch = items[start:start + batch_size]
    prompt = instructions + json.dumps(
        [{"source": item["text"], "kind": item["kind"]} for item in batch],
        ensure_ascii=False,
    )
    response = client.chat.completions.create(
        model="gpt-5-mini",
        messages=[
            {"role": "system", "content": "You are a precise localisation specialist. Output strictly according to the JSON schema."},
            {"role": "user", "content": prompt},
        ],
        max_completion_tokens=16000,
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "ui_literal_localisation", "strict": True, "schema": schema},
        },
    )
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError(f"Translation model returned no content for batch {start // batch_size + 1}")
    review = json.loads(content)
    if len(review["items"]) != len(batch):
        raise RuntimeError(f"Expected {len(batch)} records in batch {start // batch_size + 1}, received {len(review['items'])}")
    for original, translated in zip(batch, review["items"]):
        if original["text"] != translated["source"]:
            raise RuntimeError("Model response changed source ordering or source text")
        if translated["classification"] == "translate" and not translated["english"].strip():
            raise RuntimeError(f"Empty English translation for {translated['source']!r}")
    translated_items.extend(review["items"])
    print(f"Translated batch {start // batch_size + 1}: {len(batch)} literals")

output_path.write_text(json.dumps({"items": translated_items}, ensure_ascii=False, indent=2) + "\n")
print(f"Wrote {len(translated_items)} classified literals to {output_path}")
print(f"Translated: {sum(item['classification'] == 'translate' for item in translated_items)}")
