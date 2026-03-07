from app.services.analysis import AnalysisService
from app.services.material_catalog import MaterialRecord


class StubCatalogService:
    def __init__(self, records):
        self.records = list(records)

    def get_materials_by_component(self, component):
        return [row for row in self.records if row.component == component]

    def get_baseline_material(self, component, region=None):
        rows = self.get_materials_by_component(component)
        return next(row for row in rows if row.baseline)

    def get_ranked_materials(self, component, region):
        rows = [row for row in self.get_materials_by_component(component) if not row.baseline]
        return sorted(rows, key=lambda row: (row.carbon, row.cost, -row.availability))


def make_record(component, material, carbon, cost, availability, sustainability, baseline=False):
    return MaterialRecord(
        component=component,
        material=material,
        region="global",
        normalized_region="global",
        carbon=carbon,
        cost=cost,
        availability=availability,
        sustainability=sustainability,
        baseline=baseline,
    )


def test_analysis_uses_catalog_rows_only() -> None:
    components = [
        "Foundation",
        "Structure",
        "Walls",
        "Roof",
        "Insulation",
        "Windows",
        "Doors",
        "HVAC",
        "Flooring",
        "Interior Finishes",
    ]
    records = []
    for component in components:
        records.extend(
            [
                make_record(component, f"{component} Baseline", 100, 100, 90, 40, baseline=True),
                make_record(component, f"{component} A", 80, 104, 82, 72),
                make_record(component, f"{component} B", 68, 108, 75, 84),
                make_record(component, f"{component} C", 60, 112, 70, 88),
            ]
        )

    service = AnalysisService(StubCatalogService(records))
    result = service.build_ranked_analysis(
        {"project_name": "Test", "location": "Bangalore, India"},
        {"location_label": "Bangalore, India", "temperature_c": 30, "humidity_pct": 78, "wind_speed_kph": 18},
    )

    walls = next(component for component in result["components"] if component["component"] == "Walls")
    assert walls["baseline"] == "Walls Baseline"
    assert [alt["name"] for alt in walls["alternatives"]] == ["Walls C", "Walls B", "Walls A"]
    assert all(alt["name"] in {"Walls A", "Walls B", "Walls C"} for alt in walls["alternatives"])


def test_analysis_derives_metrics_from_catalog_values() -> None:
    records = [
        make_record("Foundation", "Foundation Baseline", 100, 100, 90, 40, baseline=True),
        make_record("Foundation", "Foundation A", 80, 102, 82, 72),
        make_record("Foundation", "Foundation B", 60, 108, 75, 84),
        make_record("Foundation", "Foundation C", 55, 116, 68, 90),
    ]
    for component in [
        "Structure",
        "Walls",
        "Roof",
        "Insulation",
        "Windows",
        "Doors",
        "HVAC",
        "Flooring",
        "Interior Finishes",
    ]:
        records.extend(
            [
                make_record(component, f"{component} Baseline", 100, 100, 90, 40, baseline=True),
                make_record(component, f"{component} A", 80, 105, 82, 72),
                make_record(component, f"{component} B", 70, 110, 75, 84),
                make_record(component, f"{component} C", 60, 115, 68, 88),
            ]
        )

    service = AnalysisService(StubCatalogService(records))
    result = service.build_ranked_analysis(
        {"project_name": "Metrics", "location": "Berlin, Germany"},
        {"location_label": "Berlin, Germany", "temperature_c": 11, "humidity_pct": 55, "wind_speed_kph": 8},
    )

    foundation = next(component for component in result["components"] if component["component"] == "Foundation")
    top = foundation["alternatives"][0]
    assert top["name"] == "Foundation C"
    assert top["carbon_reduction_pct"] == 45.0
    assert top["cost_delta_pct"] == 16.0
    assert -10 <= top["speed_delta_pct"] <= 10
    assert 0 <= top["sustainability_score"] <= 100
