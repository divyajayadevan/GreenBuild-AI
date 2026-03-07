from typing import Any

from app.models import COMPONENTS
from app.services.material_catalog import MaterialCatalogService, MaterialRecord


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


class AnalysisService:
    def __init__(self, catalog_service: MaterialCatalogService) -> None:
        self.catalog_service = catalog_service

    def build_ranked_analysis(self, payload: dict[str, Any], climate: dict[str, Any]) -> dict[str, Any]:
        components = []
        for component in COMPONENTS:
            baseline = self.catalog_service.get_baseline_material(component, payload["location"])
            ranked_rows = self.catalog_service.get_ranked_materials(component, payload["location"])[:3]
            if len(ranked_rows) < 3:
                raise ValueError(f"Component '{component}' has fewer than 3 ranked candidates")
            candidate_rows = self.catalog_service.get_materials_by_component(component)

            alternatives = [
                self._to_alternative(component, baseline, row, candidate_rows, climate, rank=index + 1)
                for index, row in enumerate(ranked_rows)
            ]
            components.append(
                {
                    "component": component,
                    "baseline": baseline.material,
                    "climate_note": self._climate_note(component, climate, alternatives[0]["name"]),
                    "recommendation_summary": self._component_summary(component, payload, alternatives[0]["name"]),
                    "alternatives": alternatives,
                }
            )

        top_choices = [component["alternatives"][0] for component in components]
        return {
            "executive_summary": self._executive_summary(payload, climate, components),
            "components": components,
            "implementation_notes": self._implementation_notes(payload),
            "summary_metrics": {
                "total_estimated_carbon_reduction_pct": round(
                    sum(item["carbon_reduction_pct"] for item in top_choices) / len(top_choices), 1
                ),
                "average_cost_delta_pct": round(
                    sum(item["cost_delta_pct"] for item in top_choices) / len(top_choices), 1
                ),
                "average_delivery_speed_delta_pct": round(
                    sum(item["speed_delta_pct"] for item in top_choices) / len(top_choices), 1
                ),
                "average_sustainability_score": round(
                    sum(item["sustainability_score"] for item in top_choices) / len(top_choices), 1
                ),
            },
        }

    def _to_alternative(
        self,
        component: str,
        baseline: MaterialRecord,
        row: MaterialRecord,
        candidate_rows: list[MaterialRecord],
        climate: dict[str, Any],
        rank: int,
    ) -> dict[str, Any]:
        carbon_reduction = 0.0
        if baseline.carbon > 0:
            carbon_reduction = ((baseline.carbon - row.carbon) / baseline.carbon) * 100

        cost_delta = 0.0
        if baseline.cost > 0:
            cost_delta = ((row.cost - baseline.cost) / baseline.cost) * 100

        speed_delta = _clamp((row.availability - baseline.availability) / 5, -10, 10)
        sustainability_score = self._material_score(component, row, baseline, candidate_rows, climate)
        return {
            "name": row.material,
            "summary": self._alternative_summary(component, row.material, rank),
            "carbon_reduction_pct": round(carbon_reduction, 1),
            "cost_delta_pct": round(cost_delta, 1),
            "speed_delta_pct": round(speed_delta, 1),
            "sustainability_score": round(sustainability_score, 1),
            "rationale": self._rationale(component, row, climate),
        }

    def _material_score(
        self,
        component: str,
        row: MaterialRecord,
        baseline: MaterialRecord,
        candidate_rows: list[MaterialRecord],
        climate: dict[str, Any],
    ) -> float:
        alternatives = [item for item in candidate_rows if not item.baseline]
        carbon_values = [item.carbon for item in alternatives]
        cost_values = [item.cost for item in alternatives]
        availability_values = [item.availability for item in alternatives]
        sustainability_values = [item.sustainability for item in alternatives]
        carbon_score = self._normalize_inverse(row.carbon, carbon_values)
        cost_score = self._normalize_inverse(row.cost, cost_values)
        availability_score = self._normalize_forward(row.availability, availability_values)
        sustainability_score = self._normalize_forward(row.sustainability, sustainability_values)
        climate_fit = self._climate_fit_score(row, climate)
        return _clamp(
            0.30 * carbon_score
            + 0.20 * cost_score
            + 0.20 * availability_score
            + 0.20 * sustainability_score
            + 0.10 * climate_fit,
            0,
            100,
        )

    def _climate_fit_score(self, row: MaterialRecord, climate: dict[str, Any]) -> float:
        base = 50.0
        temperature = float(climate.get("temperature_c", 24))
        humidity = float(climate.get("humidity_pct", 50))
        wind = float(climate.get("wind_speed_kph", 0))

        if row.normalized_region == "global":
            base += 5
        if humidity >= 70 and row.sustainability >= 75:
            base += 10
        if temperature >= 28 and row.availability >= 70:
            base += 10
        if wind >= 20 and row.availability >= 75:
            base += 5
        return _clamp(base, 0, 100)

    @staticmethod
    def _normalize_inverse(value: float, values: list[float]) -> float:
        if not values:
            return 0.0
        minimum = min(values)
        maximum = max(values)
        if minimum == maximum:
            return 100.0
        return ((maximum - value) / (maximum - minimum)) * 100

    @staticmethod
    def _normalize_forward(value: float, values: list[float]) -> float:
        if not values:
            return 0.0
        minimum = min(values)
        maximum = max(values)
        if minimum == maximum:
            return 100.0
        return ((value - minimum) / (maximum - minimum)) * 100

    def _executive_summary(
        self, payload: dict[str, Any], climate: dict[str, Any], components: list[dict[str, Any]]
    ) -> str:
        priorities = ", ".join(
            f"{component['component']} ({component['alternatives'][0]['name']})" for component in components[:3]
        )
        return (
            f"{payload['project_name']} uses the materials catalog as the source of truth for {climate['location_label']}. "
            f"Top near-term substitutions are {priorities}."
        )

    def _component_summary(self, component: str, payload: dict[str, Any], material_name: str) -> str:
        return (
            f"For {component.lower()}, {material_name} ranks highest from the CSV for {payload['location']} "
            f"after combining carbon, cost, availability, sustainability, and climate fit."
        )

    def _climate_note(self, component: str, climate: dict[str, Any], material_name: str) -> str:
        return (
            f"{component} was evaluated against {climate['temperature_c']}C temperature, "
            f"{climate['humidity_pct']}% humidity, and {climate['wind_speed_kph']} kph wind. "
            f"{material_name} remained the best catalog-backed option."
        )

    def _alternative_summary(self, component: str, material_name: str, rank: int) -> str:
        return f"Rank {rank} for {component.lower()}: {material_name} based strictly on the uploaded catalog values."

    def _rationale(self, component: str, row: MaterialRecord, climate: dict[str, Any]) -> str:
        return (
            f"Selected for {component.lower()} because the CSV shows carbon {row.carbon}, cost {row.cost}, "
            f"availability {row.availability}, and sustainability {row.sustainability} for {climate['location_label']}."
        )

    def _implementation_notes(self, payload: dict[str, Any]) -> list[str]:
        return [
            "Keep the materials CSV under change control because it is the system of record for all recommendations.",
            f"Re-upload the catalog before re-analysis if supplier pricing changes for {payload['location']}.",
            "Validate procurement and code compliance on the top-ranked catalog options before issuing design decisions.",
        ]
