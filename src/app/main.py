from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from app.config import get_settings
from app.models import AnalyzeRequest, ChatRequest
from app.services.climate import ClimateService
from app.services.gemini import GeminiService, slugify
from app.services.report import ReportService
from app.storage import JsonStorage


settings = get_settings()
storage = JsonStorage(settings.storage_file)
climate_service = ClimateService()
gemini_service = GeminiService(settings.gemini_api_key, settings.gemini_model)
report_service = ReportService(settings.report_dir)

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8001", "http://localhost:8001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_result(job: dict, climate: dict, analysis: dict) -> dict:
    return {
        "slug": job["slug"],
        "project_name": job["request"]["project_name"],
        "created_at": datetime.utcnow().isoformat(),
        "request": job["request"],
        "climate": climate,
        "executive_summary": analysis["executive_summary"],
        "components": analysis["components"],
        "summary_metrics": analysis["summary_metrics"],
        "implementation_notes": analysis["implementation_notes"],
        "chat_history": [],
    }


def run_analysis_job(job_id: str) -> None:
    job = storage.get_job(job_id)
    if not job:
        return

    try:
        storage.update_job(job_id, status="processing", error=None)
        climate = climate_service.fetch_climate(job["request"]["location"])
        analysis = gemini_service.generate_analysis(job["request"], climate)
        result = build_result(job, climate, analysis)
        storage.save_result(job["slug"], result)
        storage.update_job(job_id, status="completed", result_ready=True)
    except Exception as exc:
        storage.update_job(job_id, status="failed", error=str(exc))


@app.get("/")
def root() -> dict:
    return {"name": settings.app_name, "status": "ok"}


@app.get("/climate")
def get_climate(location: str = Query(..., min_length=2)) -> dict:
    return climate_service.fetch_climate(location)


@app.post("/analyze")
def analyze(payload: AnalyzeRequest, background_tasks: BackgroundTasks) -> dict:
    job_id = str(uuid4())
    slug = f"{slugify(payload.project_name)}-{job_id[:8]}"
    storage.create_job(job_id, slug, payload.model_dump())
    background_tasks.add_task(run_analysis_job, job_id)
    return {"job_id": job_id, "slug": slug, "status": "queued"}


@app.get("/status/{job_id}")
def get_status(job_id: str) -> dict:
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/results/{slug}")
def get_results(slug: str) -> dict:
    result = storage.get_result(slug)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return result


@app.get("/report/{slug}")
def get_report(slug: str) -> FileResponse:
    result = storage.get_result(slug)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    report_path = report_service.generate(result)
    return FileResponse(
        report_path,
        media_type="application/pdf",
        filename=f"{slug}.pdf",
    )


@app.post("/chat/{slug}")
def chat(slug: str, payload: ChatRequest) -> StreamingResponse:
    result = storage.get_result(slug)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    storage.append_chat_message(slug, "user", payload.message)

    def stream() -> str:
        chunks = []
        for chunk in gemini_service.stream_chat(result, payload.message):
            chunks.append(chunk)
            yield chunk
        if chunks:
            storage.append_chat_message(slug, "assistant", "".join(chunks))

    return StreamingResponse(stream(), media_type="text/plain; charset=utf-8")

if __name__ == "__main__":
    import uvicorn
    # Use "src.app.main:app" if running from the root project folder
    # Use "app.main:app" if running from inside the src folder
    uvicorn.run("src.app.main:app", host="0.0.0.0", port=8000, reload=True)