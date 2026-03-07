# GreenBuild AI

GreenBuild AI is a full-stack sustainable construction workflow app built with React 18, Vite, Tailwind CSS, FastAPI, Gemini 2.5 Flash, Open-Meteo, `fpdf2`, and local JSON storage.

## Features

- 5-step project intake form for building parameters
- Async backend analysis jobs with polling
- Open-Meteo climate enrichment
- Gemini 2.5 Flash structured material recommendations across 10 building components
- Cinematic dark dashboard with charts and component drill-down
- PDF report download
- Floating follow-up chat widget with streaming responses

## Project Structure

```text
greenbuild-ai/
  backend/
  frontend/
  .env
  .vscode/tasks.json
```

## Setup

### 1. Backend

Navigate to the backend directory:
```bash
cd backend
```

Create and activate a virtual environment:
```powershell
python -m venv .venv
.\.venv\Scripts\activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

Set your Gemini key in the `.env` file at the root of the project.

Start the API:
```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

### 2. Frontend

Navigate to the frontend directory:
```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

The Vite app runs on [http://localhost:5173](http://localhost:5173) and expects the API at [http://localhost:8000](http://localhost:8000).

## VS Code

Press `Ctrl+Shift+B` and choose the default build task to launch both servers in parallel using [.vscode/tasks.json](.vscode/tasks.json).

## API Routes

- `POST /analyze`
- `GET /status/{job_id}`
- `GET /results/{slug}`
- `GET /report/{slug}`
- `POST /chat/{slug}`
- `GET /climate?location=...`

## Notes

- If `GEMINI_API_KEY` is missing, the backend falls back to a deterministic mock analysis so the app still runs locally.
- Analysis and chat results are persisted in [db.json](/Users/mathew/Documents/New%20project/greenbuild-ai/backend/storage/db.json) after first run.

