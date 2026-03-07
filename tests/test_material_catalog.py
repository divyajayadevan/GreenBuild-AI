from pathlib import Path

import pytest

from app.models import COMPONENTS
from app.services.material_catalog import CatalogValidationError, MaterialCatalogService


HEADER = "component,material,region,carbon,cost,availability,sustainability,baseline\n"


def build_rows(component: str, region: str = "global") -> str:
    return "".join(
        [
            f"{component},Baseline {component},{region},100,100,90,40,true\n",
            f"{component},Option A {component},{region},80,105,80,72,false\n",
            f"{component},Option B {component},{region},70,110,70,80,false\n",
            f"{component},Option C {component},{region},60,115,60,85,false\n",
        ]
    )


def make_service(tmp_path: Path, content: str) -> MaterialCatalogService:
    seed = tmp_path / "seed.csv"
    storage_dir = tmp_path / "storage"
    active = storage_dir / "materials.csv"
    seed.write_text(content, encoding="utf-8")
    return MaterialCatalogService(seed, storage_dir, active)


@pytest.fixture
def valid_catalog_csv() -> str:
    return HEADER + "".join(build_rows(component) for component in COMPONENTS)


def test_loads_seed_catalog_and_exposes_queries(tmp_path: Path, valid_catalog_csv: str) -> None:
    service = make_service(tmp_path, valid_catalog_csv)

    assert service.get_summary()["row_count"] == len(COMPONENTS) * 4
    assert len(service.get_materials_by_component("Foundation")) == 4
    assert service.get_baseline_material("Foundation").material == "Baseline Foundation"
    assert len(service.get_materials_by_region("global")) == len(COMPONENTS) * 4
    assert len(service.get_ranked_materials("Foundation", "Berlin, Germany")) >= 3


def test_rejects_missing_required_columns(tmp_path: Path) -> None:
    with pytest.raises(CatalogValidationError):
        make_service(tmp_path, "component,material\nFoundation,Baseline\n")


def test_failed_replace_keeps_existing_catalog(tmp_path: Path, valid_catalog_csv: str) -> None:
    service = make_service(tmp_path, valid_catalog_csv)
    original = service.get_summary()

    with pytest.raises(CatalogValidationError):
        service.replace_catalog(b"component,material\nFoundation,Broken\n", "broken.csv")

    assert service.get_summary()["row_count"] == original["row_count"]
