import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class JsonStorage:
    def __init__(self, path: Path):
        self.path = path
        self.lock = Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._write({"jobs": {}, "results": {}})

    def _read(self) -> dict[str, Any]:
        try:
            with self.path.open("r", encoding="utf-8") as handle:
                return json.load(handle)
        except FileNotFoundError:
            return {"jobs": {}, "results": {}}

    def _write(self, data: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2)

    def create_job(self, job_id: str, slug: str, request_payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            data = self._read()
            job = {
                "job_id": job_id,
                "slug": slug,
                "status": "queued",
                "created_at": utc_now_iso(),
                "updated_at": utc_now_iso(),
                "error": None,
                "request": request_payload,
            }
            data["jobs"][job_id] = job
            self._write(data)
            return job

    def update_job(self, job_id: str, **updates: Any) -> dict[str, Any]:
        with self.lock:
            data = self._read()
            job = data["jobs"][job_id]
            job.update(updates)
            job["updated_at"] = utc_now_iso()
            data["jobs"][job_id] = job
            self._write(data)
            return job

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self.lock:
            return self._read()["jobs"].get(job_id)

    def save_result(self, slug: str, result: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            data = self._read()
            data["results"][slug] = result
            self._write(data)
            return result

    def get_result(self, slug: str) -> dict[str, Any] | None:
        with self.lock:
            return self._read()["results"].get(slug)

    def append_chat_message(self, slug: str, role: str, content: str) -> None:
        with self.lock:
            data = self._read()
            result = data["results"][slug]
            history = result.setdefault("chat_history", [])
            history.append({"role": role, "content": content, "timestamp": utc_now_iso()})
            self._write(data)

