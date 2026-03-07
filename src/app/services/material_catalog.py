import csv
import os
import shutil
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any

from app.models import COMPONENTS

REQUIRED_COLUMNS = {
    "component",
    "material",
    "region",
    "carbon",
    "cost",
    "availability",
    "sustainability",
    "baseline",
}
GENERIC_REGIONS = {"global", "generic"}


class CatalogValidationError(ValueError):
    pass


@dataclass(frozen=True)
class MaterialRecord:
    component: str
    material: str
    region: str
    normalized_region: str
    carbon: float
    cost: float
    availability: float
    sustainability: float
    baseline: bool


@dataclass(frozen=True)
class CatalogSummary:
    filename: str
    loaded_at: str
    row_count: int
    component_counts: dict[str, int]
    regions: list[str]

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class CatalogData:
    records: list[MaterialRecord]
    summary: CatalogSummary


class MaterialCatalogService:
    def __init__(self, seed_file: Path, storage_dir: Path, active_file: Path) -> None:
        self.seed_file = seed_file
        self.storage_dir = storage_dir
        self.active_file = active_file
        self._lock = RLock()
        self._catalog = self._load_initial_catalog()

    def _load_initial_catalog(self) -> CatalogData:
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        if not self.seed_file.exists():
            raise CatalogValidationError(f"Seed catalog not found: {self.seed_file}")
        if not self.active_file.exists():
            shutil.copyfile(self.seed_file, self.active_file)
        return self._load_catalog(self.active_file)

    def get_records(self) -> list[MaterialRecord]:
        with self._lock:
            return list(self._catalog.records)

    def get_summary(self) -> dict[str, Any]:
        with self._lock:
            return self._catalog.summary.as_dict()

    def get_materials_by_component(self, component: str) -> list[MaterialRecord]:
        with self._lock:
            return [row for row in self._catalog.records if row.component == component]

    def get_materials_by_region(self, region: str) -> list[MaterialRecord]:
        normalized = normalize_region(region)
        with self._lock:
            return [row for row in self._catalog.records if row.normalized_region == normalized]

    def get_baseline_material(self, component: str, region: str | None = None) -> MaterialRecord:
        rows = self.get_materials_by_component(component)
        if not rows:
            raise CatalogValidationError(f"Unknown component: {component}")

        if region:
            exact, country = parse_location_regions(region)
            for candidate_region in (exact, country):
                for row in rows:
                    if row.baseline and row.normalized_region == candidate_region:
                        return row

        for row in rows:
            if row.baseline and is_generic_region(row.normalized_region):
                return row

        for row in rows:
            if row.baseline:
                return row
        raise CatalogValidationError(f"Missing baseline row for component: {component}")

    def get_ranked_materials(self, component: str, region: str) -> list[MaterialRecord]:
        rows = self.get_materials_by_component(component)
        baseline = self.get_baseline_material(component, region)
        exact, country = parse_location_regions(region)

        def region_weight(row: MaterialRecord) -> int:
            if row.normalized_region == exact:
                return 100
            if row.normalized_region == country:
                return 85
            if is_generic_region(row.normalized_region):
                return 70
            return 0

        candidates = [row for row in rows if not row.baseline and region_weight(row) > 0]
        if len(candidates) < 3:
            fallback = [row for row in rows if not row.baseline and row.material != baseline.material]
            names = {row.material for row in candidates}
            for row in fallback:
                if row.material not in names:
                    candidates.append(row)
                    names.add(row.material)

        if not candidates:
            raise CatalogValidationError(f"No candidate materials found for component: {component}")

        carbon_values = [row.carbon for row in candidates]
        cost_values = [row.cost for row in candidates]
        availability_values = [row.availability for row in candidates]
        sustainability_values = [row.sustainability for row in candidates]

        def score(row: MaterialRecord) -> tuple[float, float, float]:
            weighted = (
                0.30 * normalize_inverse(row.carbon, carbon_values)
                + 0.20 * normalize_inverse(row.cost, cost_values)
                + 0.20 * normalize_forward(row.availability, availability_values)
                + 0.20 * normalize_forward(row.sustainability, sustainability_values)
                + 0.10 * region_weight(row)
            )
            return (round(weighted, 4), row.sustainability, row.availability)

        return sorted(candidates, key=score, reverse=True)

    def replace_catalog(self, content: bytes, filename: str) -> dict[str, Any]:
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(filename or "materials.csv").suffix or ".csv"
        fd, temp_name = tempfile.mkstemp(prefix="materials-", suffix=suffix, dir=self.storage_dir)
        temp_path = Path(temp_name)
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(content)
            catalog = self._load_catalog(temp_path, filename=filename)
            os.replace(temp_path, self.active_file)
            with self._lock:
                self._catalog = catalog
            return catalog.summary.as_dict()
        except Exception:
            if temp_path.exists():
                temp_path.unlink()
            raise

    def _load_catalog(self, path: Path, filename: str | None = None) -> CatalogData:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            fieldnames = set(reader.fieldnames or [])
            missing = sorted(REQUIRED_COLUMNS - fieldnames)
            unknown = sorted(fieldnames - REQUIRED_COLUMNS)
            if missing:
                raise CatalogValidationError(f"Missing required columns: {', '.join(missing)}")
            if unknown:
                raise CatalogValidationError(f"Unsupported columns: {', '.join(unknown)}")
            records = [self._parse_row(row, line_number) for line_number, row in enumerate(reader, start=2)]

        if not records:
            raise CatalogValidationError("Catalog is empty")

        self._validate_coverage(records)
        summary = CatalogSummary(
            filename=filename or path.name,
            loaded_at=datetime.now(timezone.utc).isoformat(),
            row_count=len(records),
            component_counts=self._component_counts(records),
            regions=sorted({record.region for record in records}),
        )
        return CatalogData(records=records, summary=summary)

    def _parse_row(self, row: dict[str, str | None], line_number: int) -> MaterialRecord:
        component = (row.get("component") or "").strip()
        material = (row.get("material") or "").strip()
        region = (row.get("region") or "").strip()
        if not component:
            raise CatalogValidationError(f"Line {line_number}: component is required")
        if not material:
            raise CatalogValidationError(f"Line {line_number}: material is required")
        if not region:
            raise CatalogValidationError(f"Line {line_number}: region is required")

        try:
            carbon = float(row.get("carbon") or "")
            cost = float(row.get("cost") or "")
            availability = float(row.get("availability") or "")
            sustainability = float(row.get("sustainability") or "")
        except ValueError as exc:
            raise CatalogValidationError(f"Line {line_number}: invalid numeric value") from exc

        if cost < 0:
            raise CatalogValidationError(f"Line {line_number}: cost must be non-negative")
        if not 0 <= availability <= 100:
            raise CatalogValidationError(f"Line {line_number}: availability must be between 0 and 100")
        if not 0 <= sustainability <= 100:
            raise CatalogValidationError(f"Line {line_number}: sustainability must be between 0 and 100")

        return MaterialRecord(
            component=component,
            material=material,
            region=region,
            normalized_region=normalize_region(region),
            carbon=carbon,
            cost=cost,
            availability=availability,
            sustainability=sustainability,
            baseline=parse_bool(row.get("baseline")),
        )

    def _validate_coverage(self, records: list[MaterialRecord]) -> None:
        for component in COMPONENTS:
            component_rows = [row for row in records if row.component == component]
            if not component_rows:
                raise CatalogValidationError(f"Missing rows for component '{component}'")
            baselines = [row for row in component_rows if row.baseline]
            candidates = [row for row in component_rows if not row.baseline]
            if not baselines:
                raise CatalogValidationError(f"Component '{component}' must include a baseline row")
            if len(candidates) < 3:
                raise CatalogValidationError(f"Component '{component}' must include at least 3 candidate rows")

            region_baselines: dict[str, int] = {}
            for row in baselines:
                region_baselines[row.normalized_region] = region_baselines.get(row.normalized_region, 0) + 1
            duplicates = [region for region, count in region_baselines.items() if count > 1]
            if duplicates:
                raise CatalogValidationError(
                    f"Component '{component}' has multiple baseline rows for region(s): {', '.join(sorted(duplicates))}"
                )

    @staticmethod
    def _component_counts(records: list[MaterialRecord]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for row in records:
            counts[row.component] = counts.get(row.component, 0) + 1
        return counts


def normalize_region(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "_" for ch in value.strip())
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    return cleaned.strip("_")


def is_generic_region(region: str) -> bool:
    return region in GENERIC_REGIONS or region.endswith("_generic")


def parse_location_regions(location: str) -> tuple[str, str]:
    parts = [part.strip() for part in location.split(",") if part.strip()]
    if len(parts) >= 2:
        return normalize_region(location), normalize_region(parts[-1])
    normalized = normalize_region(location)
    return normalized, normalized


def parse_bool(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "y"}


def normalize_inverse(value: float, values: list[float]) -> float:
    if not values:
        return 0.0
    minimum = min(values)
    maximum = max(values)
    if minimum == maximum:
        return 100.0
    return ((maximum - value) / (maximum - minimum)) * 100


def normalize_forward(value: float, values: list[float]) -> float:
    if not values:
        return 0.0
    minimum = min(values)
    maximum = max(values)
    if minimum == maximum:
        return 100.0
    return ((value - minimum) / (maximum - minimum)) * 100
