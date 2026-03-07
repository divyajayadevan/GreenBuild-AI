from typing import Any

from app.models import COMPONENTS
from app.services.material_catalog import MaterialCatalogService, MaterialRecord


MATERIAL_KNOWLEDGE_BASE = {
    "moisture_resistant": {
        "aac",
        "aluminum",
        "bituminous",
        "brick",
        "cmu",
        "concrete",
        "cool roof",
        "dx cooling",
        "fiberglass",
        "gypsum",
        "heat pump",
        "lime plaster",
        "low-voc",
        "membrane",
        "metal",
        "mineral wool",
        "precast",
        "recycled steel",
        "rubber",
        "steel",
        "vinyl",
        "vrf",
    },
    "heat_resistant": {
        "aac",
        "air-source heat pump",
        "aluminum",
        "concrete",
        "cool roof",
        "erv",
        "fiberglass",
        "ground-source heat pump",
        "heat pump",
        "low-e",
        "metal",
        "mineral wool",
        "precast",
        "standing seam",
        "timber-aluminum",
        "vacuum insulated glazing",
        "vrf",
    },
    "cold_resistant": {
        "cellulose",
        "composite",
        "doas",
        "door set",
        "erv",
        "fiberglass",
        "ground-source heat pump",
        "insulated",
        "low-e",
        "mineral wool",
        "thermally broken",
        "timber",
        "triple-glazed",
        "vacuum insulated glazing",
        "wood fiber",
    },
    "wind_resistant": {
        "aluminum",
        "cmu",
        "concrete",
        "fiberglass",
        "frame",
        "metal",
        "precast",
        "standing seam",
        "steel",
    },
    "moisture_sensitive": {
        "bamboo",
        "bio-based",
        "cellulose",
        "clt",
        "hemp",
        "mass timber",
        "timber",
        "wood fiber",
    },
}

SEASON_WEIGHTS = {
    "summer": 0.35,
    "monsoon": 0.40,
    "winter": 0.25,
}


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


class AnalysisService:
    def __init__(self, catalog_service: MaterialCatalogService) -> None:
        self.catalog_service = catalog_service

    def build_ranked_analysis(self, payload: dict[str, Any], climate: dict[str, Any], is_default_db: bool = False) -> dict[str, Any]:
        components = []
        for component in COMPONENTS:
            baseline = self.catalog_service.get_baseline_material(component, payload["location"])
            ranked_rows = self._filtered_ranked_materials(component, payload["location"], climate)[:3]
            if len(ranked_rows) < 3:
                raise ValueError(f"Component '{component}' has fewer than 3 ranked candidates")
            candidate_rows = self.catalog_service.get_materials_by_component(component)
            filtered_names = [row.material for row in ranked_rows]

            alternatives = [
                self._to_alternative(component, baseline, row, candidate_rows, climate, rank=index + 1, is_default_db=is_default_db)
                for index, row in enumerate(ranked_rows)
            ]
            components.append(
                {
                    "component": component,
                    "baseline": baseline.material,
                    "climate_note": self._climate_note(component, climate, alternatives[0]["name"], is_default_db),
                    "recommendation_summary": self._component_summary(component, payload, alternatives[0]["name"], is_default_db),
                    "filtered_catalog_materials": filtered_names,
                    "alternatives": alternatives,
                }
            )

        top_choices = [component["alternatives"][0] for component in components]
        return {
            "executive_summary": self._executive_summary(payload, climate, components, is_default_db),
            "components": components,
            "implementation_notes": self._implementation_notes(payload, is_default_db),
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

    def _filtered_ranked_materials(self, component: str, region: str, climate: dict[str, Any]) -> list[MaterialRecord]:
        ranked_rows = self.catalog_service.get_ranked_materials(component, region)
        viable_rows = [row for row in ranked_rows if self._passes_material_filter(component, row, climate)]
        if len(viable_rows) >= 3:
            return viable_rows

        fallback_rows = [row for row in ranked_rows if row not in viable_rows]
        fallback_rows.sort(
            key=lambda row: (
                self._climate_fit_score(row, climate),
                row.sustainability,
                row.availability,
            ),
            reverse=True,
        )
        return viable_rows + fallback_rows

    def _passes_material_filter(self, component: str, row: MaterialRecord, climate: dict[str, Any]) -> bool:
        if row.baseline:
            return False
        climate_fit = self._climate_fit_score(row, climate)
        seasonal_fit = self._seasonal_fit_score(component, row, climate)
        return row.sustainability >= 65 and climate_fit >= 55 and seasonal_fit >= 55

    def _to_alternative(
        self,
        component: str,
        baseline: MaterialRecord,
        row: MaterialRecord,
        candidate_rows: list[MaterialRecord],
        climate: dict[str, Any],
        rank: int,
        is_default_db: bool = False,
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
            "summary": self._alternative_summary(component, row.material, rank, is_default_db),
            "carbon_reduction_pct": round(carbon_reduction, 1),
            "cost_delta_pct": round(cost_delta, 1),
            "speed_delta_pct": round(speed_delta, 1),
            "sustainability_score": round(sustainability_score, 1),
            "rationale": self._rationale(component, row, climate, is_default_db),
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
        seasonal_fit = self._seasonal_fit_score(component, row, climate)
        return _clamp(
            0.30 * carbon_score
            + 0.20 * cost_score
            + 0.20 * availability_score
            + 0.20 * sustainability_score
            + 0.05 * climate_fit
            + 0.05 * seasonal_fit,
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
        base += (self._seasonal_fit_score(row.component, row, climate) - 50.0) * 0.2
        return _clamp(base, 0, 100)

    def _seasonal_fit_score(self, component: str, row: MaterialRecord, climate: dict[str, Any]) -> float:
        seasonal_profile = climate.get("seasonal_profile") or {}
        if not isinstance(seasonal_profile, dict) or not seasonal_profile:
            return 50.0

        name = row.material.lower()
        scores: list[float] = []
        for season_name, weight in SEASON_WEIGHTS.items():
            season = seasonal_profile.get(season_name) or {}
            if not isinstance(season, dict):
                continue
            score = 50.0
            risk_tags = set(season.get("risk_tags") or [])

            if "heat" in risk_tags:
                score += self._keyword_bonus(name, MATERIAL_KNOWLEDGE_BASE["heat_resistant"], 16)
            if "cold" in risk_tags:
                score += self._keyword_bonus(name, MATERIAL_KNOWLEDGE_BASE["cold_resistant"], 16)
            if "wind" in risk_tags:
                score += self._keyword_bonus(name, MATERIAL_KNOWLEDGE_BASE["wind_resistant"], 12)
            if "humidity" in risk_tags or "rain" in risk_tags:
                score += self._keyword_bonus(name, MATERIAL_KNOWLEDGE_BASE["moisture_resistant"], 18)
                score -= self._keyword_bonus(name, MATERIAL_KNOWLEDGE_BASE["moisture_sensitive"], 22)

            score += self._component_specific_adjustment(component, name, risk_tags)
            scores.append(score * weight)

        if not scores:
            return 50.0
        return _clamp(sum(scores) / sum(SEASON_WEIGHTS.values()), 0, 100)

    @staticmethod
    def _keyword_bonus(name: str, keywords: set[str], weight: float) -> float:
        return max((weight for keyword in keywords if keyword in name), default=0.0)

    def _component_specific_adjustment(self, component: str, material_name: str, risk_tags: set[str]) -> float:
        if component in {"Roof", "Walls", "Windows", "Doors"} and ("rain" in risk_tags or "wind" in risk_tags):
            if any(token in material_name for token in ("membrane", "metal", "fiberglass", "aac", "steel")):
                return 8.0
        if component == "Insulation" and "humidity" in risk_tags:
            if "mineral wool" in material_name or "fiberglass" in material_name:
                return 10.0
            if "cellulose" in material_name or "wood fiber" in material_name:
                return -10.0
        if component in {"Flooring", "Interior Finishes"} and ("humidity" in risk_tags or "rain" in risk_tags):
            if any(token in material_name for token in ("concrete", "rubber", "lime plaster", "gypsum", "low-voc")):
                return 8.0
            if "bamboo" in material_name or "bio-based" in material_name:
                return -8.0
        if component == "HVAC":
            if "heat" in risk_tags and "heat pump" in material_name:
                return 10.0
            if "cold" in risk_tags and "ground-source heat pump" in material_name:
                return 10.0
        return 0.0

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
        self, payload: dict[str, Any], climate: dict[str, Any], components: list[dict[str, Any]], is_default_db: bool
    ) -> str:
        priorities = ", ".join(
            f"{component['component']} ({component['alternatives'][0]['name']})" for component in components[:3]
        )
        if is_default_db:
             return f"{payload['project_name']} incorporates default industry sustainability standards for {climate['location_label']}. Top near-term substitutions include {priorities}."
        return (
            f"{payload['project_name']} uses the materials catalog as the source of truth for {climate['location_label']}. "
            f"Top near-term substitutions are {priorities}."
        )

    def _component_summary(self, component: str, payload: dict[str, Any], material_name: str, is_default_db: bool) -> str:
        if is_default_db:
             return f"For {component.lower()}, we recommend considering advanced sustainable alternatives for {payload['location']} to optimize carbon and cost."
        return (
            f"For {component.lower()}, {material_name} ranks highest from the CSV for {payload['location']} "
            f"after combining carbon, cost, availability, sustainability, and climate fit."
        )

    def _climate_note(self, component: str, climate: dict[str, Any], material_name: str, is_default_db: bool) -> str:
        seasonal_profile = climate.get("seasonal_profile") or {}
        summer = seasonal_profile.get("summer", {})
        monsoon = seasonal_profile.get("monsoon", {})
        winter = seasonal_profile.get("winter", {})
        base_temperature = climate.get("temperature_c", 24)
        base_humidity = climate.get("humidity_pct", 50)
        base_precipitation = climate.get("precipitation_mm", 0)
        if is_default_db:
             return (
                 f"{component} was evaluated against summer {summer.get('temperature_c', base_temperature)}C, "
                 f"monsoon rain {monsoon.get('precipitation_mm', base_precipitation)} mm, and winter "
                 f"{winter.get('temperature_c', base_temperature)}C conditions."
             )
        return (
            f"{component} was evaluated against summer {summer.get('temperature_c', base_temperature)}C heat, "
            f"monsoon humidity {monsoon.get('humidity_pct', base_humidity)}% with "
            f"{monsoon.get('precipitation_mm', base_precipitation)} mm rain, and winter "
            f"{winter.get('temperature_c', base_temperature)}C conditions. {material_name} remained the best catalog-backed option."
        )

    def _alternative_summary(self, component: str, material_name: str, rank: int, is_default_db: bool) -> str:
        if is_default_db:
            return f"Rank {rank} for {component.lower()}: {material_name} from the catalog after seasonal climate filtering."
        return f"Rank {rank} for {component.lower()}: {material_name} based strictly on the uploaded catalog values."

    def _rationale(self, component: str, row: MaterialRecord, climate: dict[str, Any], is_default_db: bool) -> str:
        seasonal_fit = round(self._seasonal_fit_score(component, row, climate), 1)
        if is_default_db:
            return f"Catalog material screened against seasonal climate risks for {climate['location_label']} with seasonal fit {seasonal_fit}."
        return (
            f"Selected for {component.lower()} because the CSV shows carbon {row.carbon}, cost {row.cost}, "
            f"availability {row.availability}, sustainability {row.sustainability}, and seasonal fit {seasonal_fit} for {climate['location_label']}."
        )

    def _implementation_notes(self, payload: dict[str, Any], is_default_db: bool) -> list[str]:
        if is_default_db:
            return [
                "Engage local suppliers early to verify the filtered catalog materials can meet seasonal demand peaks.",
                 f"Adjust the timeline based on summer, monsoon, and winter logistics impacts in {payload['location']}.",
                 "Evaluate the shortlisted catalog alternatives against local building codes before procurement."
            ]
        return [
            "Keep the materials CSV under change control because it is the system of record for the filtered shortlist and final recommendations.",
            f"Re-upload the catalog before re-analysis if supplier pricing or seasonal availability changes for {payload['location']}.",
            "Validate procurement and code compliance on the season-aware shortlisted catalog options before issuing design decisions.",
        ]
