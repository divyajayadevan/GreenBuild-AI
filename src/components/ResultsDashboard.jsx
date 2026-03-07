import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MOCK_TEAM_COMMENTS = {
  Foundation: [
    { role: "Civil Engineer", name: "Sarah Chen", time: "2 hours ago", text: "The LC3 concrete option looks great for carbon, but we need to verify the curing time against the updated winter schedule. The geopolymer might be safer if we hit delays." },
    { role: "Project Manager", name: "Marcus Johnson", time: "1 hour ago", text: "Agreed. I'll flag this risk. If we go with LC3, we can't afford any slip in the excavation phase." },
    { role: "Sustainability Lead", name: "Elena Rodriguez", time: "15 mins ago", text: "Just a reminder: LC3 gets us 30% closer to the overall carbon target on its own. Let's try to make the schedule work if possible." }
  ],
  Structure: [
    { role: "Architect", name: "David Kim", time: "1 day ago", text: "Mass timber hybrid frame aligns perfectly with the visual language we want for the atrium. I strongly support option 1." },
    { role: "Civil Engineer", name: "Sarah Chen", time: "4 hours ago", text: "I've reviewed the preliminary loads. We'll need to beef up the connections if we use the hybrid frame, which might eat into the cost savings." },
    { role: "Procurement", name: "James Wilson", time: "Just now", text: "Lead times for the mass timber from our primary supplier are currently at 14 weeks. Please factor that into the timeline." }
  ],
  HVAC: [
    { role: "Mechanical Engineer", name: "Priya Patel", time: "3 hours ago", text: "The VRF air-source heat pump is the right call for this climate zone. We can downsize the units if the envelope improvements get approved." },
    { role: "Architect", name: "David Kim", time: "2 hours ago", text: "If we downsize the units, does that mean we can reduce the mechanical penthouse footprint? That would free up roof space for more solar." },
    { role: "Mechanical Engineer", name: "Priya Patel", time: "10 mins ago", text: "@David Kim Yes, potentially by about 15%. Let's sync on the updated spatial requirements tomorrow." }
  ],
  default: [
    { role: "Project Manager", name: "Marcus Johnson", time: "5 hours ago", text: "Can everyone review these alternatives by EOD Friday? We need to lock in the material orders soon." },
    { role: "Sustainability Lead", name: "Elena Rodriguez", time: "2 hours ago", text: "Reviewed. The top-ranked option here aligns perfectly with our LEED certification targets." }
  ]
};

function bestAlternatives(result, userSelections = {}) {
  return result.components.map((component) => {
    const selectedAltName = userSelections[component.component] || component.alternatives[0].name;
    const selectedAlt = component.alternatives.find(a => a.name === selectedAltName) || component.alternatives[0];
    return {
      component: component.component,
      ...selectedAlt,
    };
  });
}

export function ResultsDashboard({
  result,
  selectedComponent,
  onSelectComponent,
}) {
  const [activeTab, setActiveTab] = useState("analysis");
  const [userSelections, setUserSelections] = useState({});
  const [showFinal, setShowFinal] = useState(false);

  if (showFinal) {
    return (
      <div className="animate-reveal max-w-5xl mx-auto space-y-12 py-10">
        <div className="text-center space-y-4">
          <h1 className="text-5xl lg:text-6xl font-heading text-white tracking-tight">Your Custom Build Plan</h1>
          <p className="text-white/50 text-xl font-medium">Final selected specifications for {result.project_name}</p>
        </div>
        <div className="space-y-6">
          {result.components.map(comp => {
            const selectedAltName = userSelections[comp.component] || comp.alternatives[0].name;
            const selectedAlt = comp.alternatives.find(a => a.name === selectedAltName) || comp.alternatives[0];
            return (
              <div key={comp.component} className="glass rounded-[32px] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/5 hover:border-accent/20 transition-all">
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent/80">{comp.component}</p>
                  <h3 className="text-3xl font-heading text-white">{selectedAlt.name}</h3>
                  <p className="text-white/60 text-sm max-w-3xl leading-relaxed">{selectedAlt.summary}</p>
                </div>
                <div className="md:text-right shrink-0">
                  <div className="flex md:flex-col md:items-end gap-6 md:gap-2">
                    <div>
                      <div className="text-3xl font-heading text-white">{selectedAlt.sustainability_score}</div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Score</div>
                    </div>
                    <div>
                      <div className={`text-xl font-bold ${selectedAlt.carbon_reduction_pct > 0 ? "text-accent" : "text-white"}`}>-{selectedAlt.carbon_reduction_pct}%</div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Carbon</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center flex-wrap gap-4 pt-8">
          <button onClick={() => setShowFinal(false)} className="bg-white/5 hover:bg-white/10 text-white px-10 py-4 rounded-full font-bold transition-all uppercase tracking-widest text-sm border border-white/10">
            Review Selections
          </button>
          <a
            href={`http://127.0.0.1:8001/report/${result.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-full bg-white px-8 py-4 font-bold text-bg transition-all hover:scale-[1.03] active:scale-[0.98] uppercase tracking-widest text-sm"
          >
            <span>Export Analysis</span>
            <DownloadIcon className="h-5 w-5" />
          </a>
        </div>
      </div>
    );
  }

  const selected = result.components.find((item) => item.component === selectedComponent) || result.components[0];
  const carbonData = bestAlternatives(result, userSelections);

  const currentSelectionName = userSelections[selected.component] || selected.alternatives[0].name;
  const activeAlternative = selected.alternatives.find(a => a.name === currentSelectionName) || selected.alternatives[0];
  const gaugeScore = activeAlternative.sustainability_score;

  const handleSelectAlternative = (altName) => {
    setUserSelections(prev => ({
      ...prev,
      [selected.component]: altName
    }));
  };

  const currentIndex = result.components.findIndex(c => c.component === selected.component);
  const isLastComponent = currentIndex === result.components.length - 1;

  const handleProceed = () => {
    if (!isLastComponent) {
      onSelectComponent(result.components[currentIndex + 1].component);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setShowFinal(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[260px,1fr]">
      {/* Sidebar: Navigation */}
      <aside className="animate-reveal space-y-8">
        <div className="px-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-accent/50">Navigator</p>
          <h2 className="mt-2 font-heading text-xl text-white leading-tight">{result.project_name}</h2>
        </div>

        <nav className="space-y-1">
          {result.components.map((component) => {
            const active = component.component === selected.component;
            const currentName = userSelections[component.component] || component.alternatives[0].name;
            const currentAlt = component.alternatives.find(a => a.name === currentName) || component.alternatives[0];
            const isHighSavings = currentAlt.carbon_reduction_pct > 35;

            return (
              <button
                key={component.component}
                onClick={() => onSelectComponent(component.component)}
                className={`group w-full rounded-2xl px-4 py-3.5 text-left transition-all duration-300 ${active
                  ? "bg-accent/10 text-white shadow-glow"
                  : "text-white/30 hover:bg-white/5 hover:text-white/60"
                  }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold truncate">{component.component}</span>
                  {isHighSavings && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
                </div>
                <div className={`mt-1 text-[10px] truncate opacity-50`}>
                  {currentName}
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="space-y-10">
        {/* Header & Global Stats */}
        <div className="animate-reveal animation-delay-100">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent">
                {result.request.location}
              </span>
              <span className="text-[11px] font-medium text-white/20 uppercase tracking-widest">
                Analyzed {new Date(result.created_at).toLocaleDateString()}
              </span>
            </div>
            <h1 className="font-heading text-5xl lg:text-6xl text-white tracking-tight">{result.project_name}</h1>
          </div>
        </div>

        {/* High-Level Pulse */}
        <section className="animate-reveal animation-delay-200 grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Carbon Redux" value={`${result.summary_metrics.total_estimated_carbon_reduction_pct}%`} sub="Total impact" />
          <StatCard label="Cost Delta" value={`${result.summary_metrics.average_cost_delta_pct}%`} sub="Budget shift" />
          <StatCard label="Schedule" value={`${result.summary_metrics.average_delivery_speed_delta_pct}%`} sub="Timeline delta" />
          <StatCard label="Sustainability" value={String(result.summary_metrics.average_sustainability_score)} sub="Aggregate score" />
        </section>

        {/* Tabbed Experience */}
        <div className="animate-reveal animation-delay-300 space-y-8">
          <div className="flex gap-10 border-b border-white/5">
            {["analysis", "climate", "implementation"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-5 text-sm font-bold uppercase tracking-[0.2em] transition-all ${activeTab === tab
                  ? "text-accent border-b-2 border-accent"
                  : "text-white/20 hover:text-white/50"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="min-h-[600px]">
            {activeTab === "analysis" && (
              <div className="space-y-8">
                {/* Integrated System Header */}
                <div className="rounded-[40px] glass p-10 lg:p-12 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-10">
                    <Gauge score={gaugeScore} size={200} />
                  </div>

                  <div className="relative max-w-2xl space-y-8">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-accent">Active System</p>
                      <h3 className="font-heading text-5xl text-white">{selected.component}</h3>
                    </div>

                    <div className="grid gap-8 sm:grid-cols-2 border-t border-white/5 pt-8">
                      <div>
                        <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-2">Original Spec</p>
                        <p className="text-xl text-white font-medium">{selected.baseline}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-accent/60 uppercase tracking-widest mb-2">Selected Option</p>
                        <p className="text-xl text-white font-bold">{activeAlternative.name}</p>
                      </div>
                    </div>

                    <p className="text-lg leading-relaxed text-white/50">{selected.recommendation_summary}</p>
                  </div>
                </div>

                {/* Alternatives Grid */}
                <div className="grid gap-6 md:grid-cols-3">
                  {selected.alternatives.map((alt, i) => (
                    <AlternativeCard
                      key={alt.name}
                      alt={alt}
                      rank={i + 1}
                      isSelected={currentSelectionName === alt.name}
                      onSelect={() => handleSelectAlternative(alt.name)}
                    />
                  ))}
                </div>

                <div className="flex justify-end pt-4 mb-8">
                  <button
                    onClick={handleProceed}
                    className="flex items-center gap-3 bg-accent text-bg hover:bg-white hover:scale-[1.02] transition-all px-8 py-4 rounded-full font-bold uppercase tracking-widest text-sm shadow-glow"
                  >
                    {isLastComponent ? "View Final Project" : "Proceed to Next Factor"}
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>

                {/* Team Collaboration Prototype */}
                <div className="rounded-[40px] glass p-10 mt-8 mb-8 border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/20 via-accent/60 to-accent/20" />
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 mb-2">Cross-Discipline Check</p>
                      <h4 className="font-heading text-2xl text-white">Team Brainstorming</h4>
                    </div>
                    <span className="rounded-full bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/40 border border-white/10">
                      Prototype Mode
                    </span>
                  </div>
                  
                  <div className="space-y-6">
                    {(MOCK_TEAM_COMMENTS[selected.component] || MOCK_TEAM_COMMENTS.default).map((comment, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="shrink-0 h-10 w-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center font-heading text-accent text-lg">
                          {comment.name.charAt(0)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-baseline gap-3">
                            <span className="font-bold text-white text-sm">{comment.name}</span>
                            <span className="text-[10px] uppercase tracking-wider text-accent font-bold">{comment.role}</span>
                            <span className="text-xs text-white/30">{comment.time}</span>
                          </div>
                          <p className="text-sm text-white/60 leading-relaxed bg-white/5 rounded-2xl rounded-tl-none p-4 border border-white/5">
                            {comment.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-8 flex gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center font-heading text-white/40 text-lg">
                      U
                    </div>
                    <div className="flex-1 relative">
                      <input 
                        type="text" 
                        placeholder="Add your design input..." 
                        className="w-full bg-white/5 border border-white/10 rounded-full px-6 py-3 text-sm text-white outline-none focus:border-accent transition-all placeholder:text-white/20"
                        readOnly
                      />
                      <button className="absolute right-2 top-1.5 bottom-1.5 px-4 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:bg-white/20 hover:text-white transition-all cursor-not-allowed">
                        Post
                      </button>
                    </div>
                  </div>
                </div>

                {/* Portfolio Context */}
                <div className="rounded-[40px] glass p-8">
                  <div className="flex items-center justify-between mb-10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">System Comparative</p>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-white/20">
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-accent" /> High Saving</div>
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-white/10" /> Base</div>
                    </div>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={carbonData}>
                        <XAxis dataKey="component" hide />
                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ background: '#050807', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }} />
                        <Bar dataKey="carbon_reduction_pct">
                          {carbonData.map((entry) => (
                            <Cell key={entry.component} fill={entry.component === selected.component ? "#22C55E" : "rgba(255,255,255,0.05)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "climate" && (
              <div className="grid gap-8 lg:grid-cols-2">
                <div className="rounded-[40px] glass p-10 space-y-10">
                  <h3 className="font-heading text-3xl text-white tracking-tight">Environmental Context</h3>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <ClimateItem label="Temperature" value={`${result.climate.temperature_c}°C`} />
                    <ClimateItem label="Humidity" value={`${result.climate.humidity_pct}%`} />
                    <ClimateItem label="Wind Velocity" value={`${result.climate.wind_speed_kph} kph`} />
                    <ClimateItem label="Moisture" value={`${result.climate.precipitation_mm} mm`} />
                  </div>
                </div>
                <div className="rounded-[40px] glass p-10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-8">Adaptive Logic</p>
                  <div className="space-y-6">
                    {result.climate.next_days_summary.map((day, i) => (
                      <div key={i} className="flex items-center gap-6 group">
                        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 text-[10px] font-black text-white/20 group-hover:text-accent transition-colors">0{i + 1}</div>
                        <p className="text-white/60 font-medium">{day}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "implementation" && (
              <div className="max-w-4xl space-y-8">
                <div className="rounded-[40px] glass p-12">
                  <h3 className="font-heading text-4xl text-white mb-10 tracking-tight">Execution Strategy</h3>
                  <div className="grid gap-10 sm:grid-cols-2">
                    {result.implementation_notes.map((note, i) => (
                      <div key={i} className="space-y-4">
                        <div className="h-0.5 w-8 bg-accent" />
                        <p className="text-xl text-white/70 leading-relaxed font-medium">{note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-[32px] glass p-8 hover-lift cursor-default">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20">{label}</p>
      <p className="mt-4 font-heading text-4xl text-white tracking-tighter">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-white/30 uppercase tracking-widest">{sub}</p>
    </div>
  );
}

function AlternativeCard({ alt, rank, isSelected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`text-left rounded-[36px] p-8 space-y-8 transition-all duration-300 hover-lift ${isSelected ? "bg-accent/10 border-2 border-accent/40 shadow-[0_0_30px_rgba(34,197,94,0.15)] scale-[1.02] ring-1 ring-accent" : "bg-white/5 border-2 border-transparent hover:bg-white/10 hover:border-white/10"
        }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${isSelected ? "bg-accent/20 text-accent border-accent/30" : "bg-white/10 text-white/40 border-transparent"}`}>
          OPTION 0{rank}
        </span>
        <span className="text-[11px] font-black text-white/30 uppercase tracking-[0.2em]">{alt.sustainability_score} SCORE</span>
      </div>

      <div className="space-y-4">
        <h4 className="font-heading text-2xl text-white leading-tight">{alt.name}</h4>
        <p className="text-sm leading-relaxed text-white/50 line-clamp-3">{alt.summary}</p>
      </div>

      <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Carbon</p>
          <p className={`text-lg font-bold ${alt.carbon_reduction_pct > 0 ? "text-accent" : "text-white"}`}>-{alt.carbon_reduction_pct}%</p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Cost</p>
          <p className={`text-lg font-bold ${alt.cost_delta_pct <= 0 ? "text-accent" : "text-white/80"}`}>{alt.cost_delta_pct > 0 ? "+" : ""}{alt.cost_delta_pct}%</p>
        </div>
      </div>
    </button>
  );
}

function Gauge({ score, size = 100 }) {
  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="80%" outerRadius="100%" data={[{ value: score }]} startAngle={90} endAngle={90 - (360 * score / 100)}>
          <RadialBar dataKey="value" fill="#22C55E" cornerRadius={size / 10} />
          {size > 120 && (
            <text x="50%" y="54%" textAnchor="middle" fill="#22C55E" className="font-heading text-5xl font-bold">{score}</text>
          )}
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClimateItem({ label, value }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em]">{label}</p>
      <p className="text-3xl font-heading text-white">{value}</p>
    </div>
  );
}

function DownloadIcon(props) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

