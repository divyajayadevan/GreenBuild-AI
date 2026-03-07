from functools import lru_cache
from pathlib import Path
import os

from dotenv import load_dotenv
from pydantic import BaseModel


ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")


class Settings(BaseModel):
    app_name: str = "GreenBuild AI"
    gemini_api_key: str = ""
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    storage_file: Path = ROOT_DIR / "src" / "storage" / "db.json"
    report_dir: Path = ROOT_DIR / "src" / "storage" / "reports"
    gemini_model: str = "gemini-2.5-flash"
    materials_seed_file: Path = ROOT_DIR / "data" / "materials_catalog" / "materials.csv"
    materials_storage_dir: Path = ROOT_DIR / "src" / "storage" / "materials_catalog"
    materials_active_file: Path = materials_storage_dir / "materials.csv"


@lru_cache
def get_settings() -> Settings:
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
    )
