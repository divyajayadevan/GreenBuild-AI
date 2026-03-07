from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


COMPONENTS = [
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


class AnalyzeRequest(BaseModel):
    project_name: str = Field(..., min_length=2, max_length=120)
    building_type: str = Field(..., min_length=2, max_length=120)
    location: str = Field(..., min_length=2, max_length=120)
    structure: str = Field(..., min_length=2, max_length=120)
    budget: str = Field(..., min_length=1, max_length=120)
    leed_level: str = Field(default="Gold")
    certifications: list[str] = Field(default_factory=list)
    notes: str = Field(default="", max_length=1000)
    number_of_floors: str | None = None
    soil_type: str | None = None
    acceptable_cost_increase: str | None = None
    priority_ranking: str | None = None
    carbon_reduction_target: str | None = None


class Alternative(BaseModel):
    name: str
    summary: str
    carbon_reduction_pct: float
    cost_delta_pct: float
    speed_delta_pct: float
    sustainability_score: float
    rationale: str


class ComponentRecommendation(BaseModel):
    component: str
    baseline: str
    climate_note: str
    recommendation_summary: str
    alternatives: list[Alternative]


class SummaryMetrics(BaseModel):
    total_estimated_carbon_reduction_pct: float
    average_cost_delta_pct: float
    average_delivery_speed_delta_pct: float
    average_sustainability_score: float


class ClimateSnapshot(BaseModel):
    location_label: str
    latitude: float
    longitude: float
    temperature_c: float
    temp_max: float | None = None
    temp_min: float | None = None
    wind_speed_kph: float
    precipitation_mm: float
    humidity_pct: float
    next_days_summary: list[str]
    source: str | None = None
    basis: str | None = None
    seasonal_profile: dict = Field(default_factory=dict)
    climate_risks: list[str] = Field(default_factory=list)


class AnalysisResult(BaseModel):
    slug: str
    project_name: str
    created_at: datetime
    request: AnalyzeRequest
    climate: ClimateSnapshot
    executive_summary: str
    components: list[ComponentRecommendation]
    summary_metrics: SummaryMetrics
    implementation_notes: list[str]
    chat_history: list[dict] = Field(default_factory=list)


class JobStatus(BaseModel):
    job_id: str
    slug: str
    status: Literal["queued", "processing", "completed", "failed"]
    created_at: datetime
    updated_at: datetime
    error: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=2, max_length=1000)
