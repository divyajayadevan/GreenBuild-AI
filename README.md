# GreenBuild AI

A full-stack sustainable construction workflow app built with React 18, Vite, Tailwind CSS, FastAPI, Gemini 2.5 Flash, Open-Meteo, fpdf2, and local JSON storage.

## Features

- 5-step project intake form for building parameters
- Async backend analysis jobs with polling
- Open-Meteo climate enrichment
- Gemini 2.5 Flash structured material recommendations across 10 building components
- Cinematic dark dashboard with charts and component drill-down
- PDF report download
- Floating follow-up chat widget with streaming responses

## Project Structure
```bash
src/
├── app/                   
│   ├── services/           
│   │   ├── climate.py
│   │   ├── gemini.py
│   │   └── report.py
│   ├── config.py            
│   ├── main.py            
│   ├── models.py           
│   └── storage.py        
├── components/      
│   ├── ChatWidget.jsx
│   ├── MultiStepForm.jsx
│   ├── ProcessingScreen.jsx
│   └── ResultsDashboard.jsx
├── lib/                    
│   └── api.js          
├── storage/             
│   └── reports/       
├── App.jsx             
├── index.css     
└── main.jsx       
```

## How to run


Install dependencies:
```bash
pip install -r requirements.txt
```

Set your `GEMINI_API_KEY` in a `.env` file at the root of the project.

Start the API:
```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```


Start the development server:
```bash
npm run dev
```
 ## Contributors
<a href="https://github.com/username-0011/GreenBuild-AI/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=username-0011/GreenBuild-AI" />
</a>
  
 
 By the IDK team