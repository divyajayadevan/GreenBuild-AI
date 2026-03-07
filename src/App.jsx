import { useEffect, useMemo, useState } from "react";
import { Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChatWidget } from "./components/ChatWidget";
import { MultiStepForm } from "./components/MultiStepForm";
import { ProcessingScreen } from "./components/ProcessingScreen";
import { ResultsDashboard } from "./components/ResultsDashboard";
import { api } from "./lib/api";

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-white selection:bg-accent/30 selection:text-white">
      <Backdrop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/results/:slug" element={<ResultsPage />} />
      </Routes>
    </div>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const [climatePreview, setClimatePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogUploadLoading, setCatalogUploadLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      setCatalogLoading(true);
      try {
        const data = await api.materialsCatalog();
        if (!active) return;
        setCatalog(data);
        setCatalogError("");
      } catch (error) {
        if (!active) return;
        setCatalogError(error.message || "Failed to load catalog metadata.");
      } finally {
        if (active) setCatalogLoading(false);
      }
    }

    loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  async function handleClimatePreview(location) {
    try {
      const data = await api.climate(location);
      setClimatePreview(data);
    } catch (error) {
      setClimatePreview(null);
    }
  }

  async function handleSubmit(form) {
    setLoading(true);
    try {
      const response = await api.analyze(form);
      navigate(`/results/${response.slug}?job=${response.job_id}`);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Failed to start analysis. Please ensure the backend is running at " + api.base + "\n\nError: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCatalogUpload(file) {
    setCatalogUploadLoading(true);
    try {
      const data = await api.uploadMaterialsCatalog(file);
      setCatalog(data);
      setCatalogError("");
      return data;
    } catch (error) {
      setCatalogError(error.message || "Upload failed.");
      throw error;
    } finally {
      setCatalogUploadLoading(false);
    }
  }

  return (
    <main className="relative mx-auto max-w-7xl px-6 pb-24 pt-10 md:px-10 lg:px-12">
      <header className="flex items-center justify-end py-8">
        <a
          href="#builder"
          className="rounded-full bg-white/5 border border-white/10 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10 hover:border-white/20 active:scale-[0.98]"
        >
          Start Project
        </a>
      </header>

      <section className="grid gap-16 py-20 xl:grid-cols-[1.1fr,0.9fr] xl:items-center">
        <div className="animate-reveal">
          <div className="inline-flex rounded-full border border-accent/20 bg-accent/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.4em] text-accent">
            Gemini 2.5 Flash + Climate Engine
          </div>
          <h1 className="mt-8 max-w-4xl font-heading text-7xl leading-[1.05] text-white md:text-9xl tracking-tighter uppercase">
            GreenBuild <span className="text-accent">AI</span>
          </h1>
          <p className="mt-10 max-w-2xl text-xl leading-relaxed text-white/50">
            High-performance material options, carbon impact tracking, and delivery implications in seconds.
          </p>
        </div>

        <div className="relative animate-reveal animation-delay-200">
          <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-accent/10 blur-[120px]" />
          <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="relative aspect-square flex items-center justify-center rounded-[48px] glass p-16 shadow-glow transition-all hover:scale-[1.02]">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-32 w-32 rounded-full bg-accent/20 blur-2xl animate-pulse" />
              <div className="relative h-24 w-24 rounded-3xl bg-accent flex items-center justify-center font-heading text-5xl font-bold text-bg shadow-2xl">
                G
              </div>
              <div className="absolute -bottom-12 text-[10px] font-black uppercase tracking-[0.5em] text-white/20 whitespace-nowrap">
                Project Brand Space
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 animate-reveal">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard title="Component Matrix" text="10+ systems ranked with green alternatives." />
          <FeatureCard title="Climate Sync" text="Live environmental data integration." />
          <FeatureCard title="Carbon Index" text="Embodied carbon reduction tracking." />
          <FeatureCard title="Strategy Engine" text="Context-aware implementation steps for every material." />
        </div>
      </section>

      <section id="builder" className="py-32 flex justify-center border-t border-white/5">
        <div className="w-full max-w-5xl">
          <div className="mb-16 text-center animate-reveal">
            <h2 className="font-heading text-4xl text-white tracking-tight">Initiate Project Analysis</h2>
            <p className="mt-4 text-white/40 text-lg">Configure your project specs below to begin the Gemini optimization workflow.</p>
          </div>
          <MultiStepForm
            catalog={catalog}
            catalogError={catalogError}
            catalogLoading={catalogLoading}
            catalogUploadLoading={catalogUploadLoading}
            climatePreview={climatePreview}
            loading={loading}
            onUploadCatalog={handleCatalogUpload}
            onPreviewClimate={handleClimatePreview}
            onSubmit={handleSubmit}
          />
        </div>
      </section>
    </main>
  );
}

function ResultsPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("job");
  const [result, setResult] = useState(null);
  const [job, setJob] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let intervalId;

    async function loadResult() {
      try {
        const data = await api.results(slug);
        if (!active) return;
        setResult(data);
        setSelectedComponent(data.components[0]?.component || "");
        setChatHistory(data.chat_history || []);
      } catch (loadError) {
        if (!jobId) {
          if (active) setError("Result not found.");
          return;
        }

        intervalId = window.setInterval(async () => {
          try {
            const status = await api.status(jobId);
            if (!active) return;
            setJob(status);
            if (status.status === "completed") {
              window.clearInterval(intervalId);
              const resolved = await api.results(slug);
              if (!active) return;
              setResult(resolved);
              setSelectedComponent(resolved.components[0]?.component || "");
              setChatHistory(resolved.chat_history || []);
            }
            if (status.status === "failed") {
              window.clearInterval(intervalId);
              setError(status.error || "Analysis failed.");
            }
          } catch (statusError) {
            window.clearInterval(intervalId);
            setError("Status polling failed.");
          }
        }, 2500);
      }
    }

    loadResult();

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [jobId, slug]);

  const processingLocation = useMemo(() => job?.request?.location || "your selected location", [job]);

  function appendChat(message, replaceLast = false) {
    setChatHistory((current) => {
      if (replaceLast) return [...current.slice(0, -1), message];
      return [...current, message];
    });
  }

  return (
    <main className="relative min-h-screen px-5 py-8 md:px-8 lg:px-10 animate-reveal">
      <div className="relative mx-auto max-w-7xl">
        {error && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-200">
            {error}
          </div>
        )}

        {!error && !result && <ProcessingScreen jobStatus={job?.status} location={processingLocation} />}

        {result && (
          <>
            <ResultsDashboard
              result={result}
              selectedComponent={selectedComponent}
              onSelectComponent={setSelectedComponent}
            />
            <ChatWidget
              apiBase={api.base}
              history={chatHistory}
              onAppend={appendChat}
              slug={result.slug}
            />
          </>
        )}
      </div>
    </main>
  );
}

function FeatureCard({ title, text }) {
  return (
    <div className="rounded-[32px] glass p-8 hover-lift cursor-default group transition-all">
      <div className="h-0.5 w-6 bg-accent/40 group-hover:w-10 transition-all mb-6" />
      <p className="font-heading text-xl text-white tracking-tight">{title}</p>
      <p className="mt-4 text-sm leading-relaxed text-white/40">{text}</p>
    </div>
  );
}

function Backdrop() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="blob left-[-10%] top-[-10%] h-[600px] w-[600px] bg-accent/10 opacity-60" style={{ animationDelay: '0s' }} />
      <div className="blob right-[-5%] top-[10%] h-[500px] w-[500px] bg-emerald-500/10 opacity-40" style={{ animationDelay: '-5s' }} />
      <div className="blob left-[20%] bottom-[-10%] h-[700px] w-[700px] bg-accent/5 opacity-50" style={{ animationDelay: '-10s' }} />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.16]" />
    </div>
  );
}
