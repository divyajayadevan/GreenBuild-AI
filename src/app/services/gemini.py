import json
import re
from typing import Any, Iterable

from google import genai
from google.genai import types

from app.models import COMPONENTS


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "greenbuild-project"


class GeminiService:
    def __init__(self, api_key: str, model_name: str) -> None:
        self.api_key = api_key
        self.model_name = model_name
        self.client = None
        if api_key and api_key != "your_gemini_api_key_here":
            self.client = genai.Client(api_key=api_key)

    def _prompt(self, payload: dict[str, Any], climate: dict[str, Any], ranked_analysis: dict[str, Any]) -> str:
        return f"""
You are a sustainable construction advisor. Produce strict JSON only.

Project input:
{json.dumps(payload, indent=2)}

Climate input:
{json.dumps(climate, indent=2)}

Catalog-backed analysis input:
{json.dumps(ranked_analysis, indent=2)}

Return JSON with this exact top-level shape:
{{
  "executive_summary": "string",
  "implementation_notes": ["string", "string", "string"],
  "components": [
    {{
      "component": "Foundation",
      "climate_note": "string",
      "recommendation_summary": "string",
      "alternatives": [
        {{
          "summary": "string",
          "rationale": "string"
        }}
      ]
    }}
  ]
}}

Requirements:
- Use only component names, material names, and metrics already present in the catalog-backed analysis input.
- Do not add, remove, rename, or reorder components or alternatives.
- Do not change baseline names or any numeric values.
- Include exactly these 10 components: {", ".join(COMPONENTS)}.
- For each component include exactly 3 alternatives in the existing order.
- Only write explanation text.
- No markdown, no commentary outside JSON.
""".strip()

    def enrich_analysis(
        self, payload: dict[str, Any], climate: dict[str, Any], ranked_analysis: dict[str, Any]
    ) -> dict[str, Any]:
        if not self.client:
            return ranked_analysis

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=self._prompt(payload, climate, ranked_analysis),
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.4,
                ),
            )
            text = response.text if hasattr(response, "text") else ""
            data = json.loads(text)
            return self._merge_explanations(ranked_analysis, data)
        except Exception:
            return ranked_analysis

    def _merge_explanations(self, ranked_analysis: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
        merged = {
            **ranked_analysis,
            "executive_summary": data.get("executive_summary") or ranked_analysis["executive_summary"],
            "implementation_notes": (
                data.get("implementation_notes")[:3]
                if isinstance(data.get("implementation_notes"), list) and data.get("implementation_notes")
                else ranked_analysis["implementation_notes"]
            ),
        }
        by_component = {
            component.get("component"): component
            for component in data.get("components", [])
            if isinstance(component, dict) and component.get("component")
        }
        merged_components = []
        for ranked_component in ranked_analysis["components"]:
            source_component = by_component.get(ranked_component["component"], {})
            source_alternatives = (
                source_component.get("alternatives", []) if isinstance(source_component, dict) else []
            )
            alternatives = []
            for index, ranked_alt in enumerate(ranked_component["alternatives"]):
                source_alt = (
                    source_alternatives[index]
                    if index < len(source_alternatives) and isinstance(source_alternatives[index], dict)
                    else {}
                )
                alternatives.append(
                    {
                        **ranked_alt,
                        "summary": source_alt.get("summary") or ranked_alt["summary"],
                        "rationale": source_alt.get("rationale") or ranked_alt["rationale"],
                    }
                )
            merged_components.append(
                {
                    **ranked_component,
                    "climate_note": source_component.get("climate_note") or ranked_component["climate_note"],
                    "recommendation_summary": source_component.get("recommendation_summary")
                    or ranked_component["recommendation_summary"],
                    "alternatives": alternatives,
                }
            )
        merged["components"] = merged_components
        return merged

    def stream_chat(self, result: dict[str, Any], message: str) -> Iterable[str]:
        if not self.client:
            answer = (
                f"For {result['project_name']}, focus on the top-ranked {result['components'][0]['component'].lower()} "
                f"and HVAC moves first. {message.strip()} maps back to climate resilience, embodied carbon, and supplier timing."
            )
            for chunk in re.findall(r".{1,28}", answer):
                yield chunk
            return

        prompt = f"""
You are GreenBuild AI. Answer the follow-up question using the stored project result.
Be concise, practical, and specific to the recommendations.

Project result:
{json.dumps(result, indent=2)}

User question:
{message}
""".strip()
        try:
            response = self.client.models.generate_content_stream(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.5),
            )
            for chunk in response:
                text = getattr(chunk, "text", "")
                if text:
                    yield text
        except Exception:
            fallback = "I could not reach Gemini for a live follow-up, so use the highest scoring envelope and HVAC options as the default recommendation set."
            for chunk in re.findall(r".{1,28}", fallback):
                yield chunk
