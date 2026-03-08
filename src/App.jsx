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

  async function handleCatalogReset() {
    setCatalogUploadLoading(true);
    try {
      const data = await api.resetMaterialsCatalog();
      setCatalog(data);
      setCatalogError("");
      return data;
    } catch (error) {
      setCatalogError(error.message || "Reset failed.");
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

      <section className="py-20 flex flex-col items-center text-center xl:items-start xl:text-left">
        <div className="animate-reveal">
          <div className="inline-flex rounded-full border border-accent/20 bg-accent/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.4em] text-accent">
            Gemini 2.5 Flash + Climate Engine
          </div>
          <div className="mt-8 flex flex-col md:flex-row items-center gap-6 overflow-hidden py-4">
            <div className="flex-shrink-0 animate-slide-in relative flex items-center justify-center h-20 w-20 md:h-28 md:w-28 rounded-[24px] md:rounded-[36px] bg-accent shadow-[0_0_40px_rgba(34,197,94,0.3)]">
              <span className="font-heading text-6xl md:text-8xl font-black text-[#1A1A1A] tracking-tighter" style={{ fontFamily: 'Sora, sans-serif' }}>S</span>
            </div>
            <h1 className="animate-fade-in-text font-heading text-5xl leading-[1.05] text-white md:text-7xl lg:text-[5rem] tracking-tighter uppercase whitespace-normal md:whitespace-nowrap">
              SAGE <span className="text-accent">ALTERNATIVES</span>
            </h1>
          </div>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-white/50">
            High-performance material options, carbon impact tracking, and delivery implications in seconds.
          </p>
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
            onResetCatalog={handleCatalogReset}
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
