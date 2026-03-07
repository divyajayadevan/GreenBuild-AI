from app.services.gemini import GeminiService


def test_merge_explanations_preserves_catalog_materials_and_metrics() -> None:
    service = GeminiService("", "test-model")
    ranked_analysis = {
        "executive_summary": "Catalog summary",
        "implementation_notes": ["a", "b", "c"],
        "summary_metrics": {"total_estimated_carbon_reduction_pct": 12.0},
        "components": [
            {
                "component": "Walls",
                "baseline": "CMU",
                "climate_note": "Catalog note",
                "recommendation_summary": "Catalog recommendation",
                "filtered_catalog_materials": ["Fly Ash Brick", "AAC Block", "Brick"],
                "alternatives": [
                    {
                        "name": "Fly Ash Brick",
                        "summary": "Catalog summary 1",
                        "carbon_reduction_pct": 30.0,
                        "cost_delta_pct": 5.0,
                        "speed_delta_pct": 2.0,
                        "sustainability_score": 88.0,
                        "rationale": "Catalog rationale 1",
                    },
                    {
                        "name": "AAC Block",
                        "summary": "Catalog summary 2",
                        "carbon_reduction_pct": 20.0,
                        "cost_delta_pct": 7.0,
                        "speed_delta_pct": 1.0,
                        "sustainability_score": 80.0,
                        "rationale": "Catalog rationale 2",
                    },
                    {
                        "name": "Brick",
                        "summary": "Catalog summary 3",
                        "carbon_reduction_pct": 10.0,
                        "cost_delta_pct": 3.0,
                        "speed_delta_pct": 0.0,
                        "sustainability_score": 70.0,
                        "rationale": "Catalog rationale 3",
                    },
                ],
            }
        ],
    }
    generated = {
        "executive_summary": "Gemini explanation",
        "implementation_notes": ["x", "y", "z"],
        "components": [
            {
                "component": "Walls",
                "climate_note": "Gemini climate note",
                "recommendation_summary": "Gemini recommendation",
                "alternatives": [
                    {"name": "Invented Wall Panel", "summary": "Gemini summary", "rationale": "Gemini rationale", "carbon_reduction_pct": 99},
                    {"summary": "Gemini summary 2", "rationale": "Gemini rationale 2"},
                    {"summary": "Gemini summary 3", "rationale": "Gemini rationale 3"},
                ],
            }
        ],
    }

    merged = service._merge_explanations(ranked_analysis, generated)

    top = merged["components"][0]["alternatives"][0]
    assert top["name"] == "Fly Ash Brick"
    assert top["carbon_reduction_pct"] == 30.0
    assert top["summary"] == "Gemini summary"
    assert merged["components"][0]["baseline"] == "CMU"
    assert merged["components"][0]["filtered_catalog_materials"] == ["Fly Ash Brick", "AAC Block", "Brick"]
