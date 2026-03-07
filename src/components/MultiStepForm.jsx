import { useState } from "react";
import { MaterialsAdminPanel } from "./MaterialsAdminPanel";
import { SeasonalClimateCard } from "./SeasonalClimateCard";

const baseCertifications = [
  "LEED",
  "BREEAM",
  "IGBC",
  "WELL BUILDING STANDARD",
  "CASBEE",
];

const leedLevelOptions = [
  "Certified",
  "Silver",
  "Gold",
  "Platinum"
];

const locationOptions = [
  { group: "Global Hubs", places: ["Singapore", "New York, USA", "London, UK", "Dubai, UAE", "Sydney, Australia", "Tokyo, Japan", "Berlin, Germany"] },
  { group: "India - North", places: ["Delhi, India", "Gurugram, India", "Noida, India", "Chandigarh, India", "Jaipur, India"] },
  { group: "India - South", places: ["Bangalore, India", "Hyderabad, India", "Chennai, India", "Kochi, India", "Visakhapatnam, India"] },
  { group: "India - West", places: ["Mumbai, India", "Pune, India", "Ahmedabad, India", "Surat, India"] },
  { group: "India - East", places: ["Kolkata, India", "Bhubaneswar, India", "Guwahati, India"] },
];

const soilOptions = [
  "Clay",
  "Sand",
  "Silt",
  "Peat",
  "Chalk",
  "Loam",
  "Rock/Bedrock"
];

export function MultiStepForm({
  onSubmit,
  onPreviewClimate,
  climatePreview,
  loading,
  catalog,
  catalogError,
  catalogLoading,
  catalogUploadLoading,
  onUploadCatalog,
  onResetCatalog,
}) {
  const [form, setForm] = useState({
    project_name: "Harbor Edge Office",
    building_type: "Mixed-use commercial",
    location: "Singapore",
    structure: "Steel composite frame",
    budget: "$14M - $18M",
    certifications: [...baseCertifications],
    leed_level: "Gold",
    notes: "Prioritize low embodied carbon materials without extending schedule beyond 6 months.",
    number_of_floors: "",
    soil_type: "",
    acceptable_cost_increase: "",
    priority_ranking: "",
    carbon_reduction_target: "",
  });

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleCertification(value) {
    const current = new Set(form.certifications);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    updateField("certifications", [...current]);
  }

  return (
    <section className="rounded-[40px] glass p-10 shadow-glow xl:p-14 animate-reveal">
      <div className="mb-14 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-accent">
            Project Configurator
          </p>
          <h2 className="mt-4 font-heading text-5xl text-white tracking-tighter">Define Blueprint</h2>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-2">
        {/* Section 1: Identity & Location */}
        <div className="space-y-10">
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/20 mb-6">Identity & Basis</h3>
            <div className="space-y-6">
              <Field label="Project core name">
                <Input value={form.project_name} onChange={(event) => updateField("project_name", event.target.value)} />
              </Field>
              <Field label="Building typology">
                <Input value={form.building_type} onChange={(event) => updateField("building_type", event.target.value)} />
              </Field>
              <Field label="Number of floors">
                <Input value={form.number_of_floors} onChange={(event) => updateField("number_of_floors", event.target.value)} placeholder="e.g. 15" />
              </Field>
              <Field label="Global location">
                <LocationSelector 
                  value={form.location} 
                  onChange={(val) => updateField("location", val)} 
                />
              </Field>
              <button
                type="button"
                onClick={() => onPreviewClimate(form.location)}
                className="group flex items-center gap-3 rounded-full bg-white/5 border border-white/10 px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-white transition-all hover:bg-white/10 hover:border-accent/40"
              >
                <span>Verify Climate Data</span>
                <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              </button>
              {climatePreview && (
                <SeasonalClimateCard climate={climatePreview} className="animate-reveal" compact />
              )}
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/20 mb-6">Physics & Economics</h3>
            <div className="space-y-6">
              <Field label="Primary structural system">
                <Input value={form.structure} onChange={(event) => updateField("structure", event.target.value)} />
              </Field>
              <Field label="Total budget range">
                <Input value={form.budget} onChange={(event) => updateField("budget", event.target.value)} />
              </Field>
              <Field label="Acceptable cost increase">
                <Input value={form.acceptable_cost_increase} onChange={(event) => updateField("acceptable_cost_increase", event.target.value)} placeholder="e.g. 5-10%" />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/20 mb-6">Site Conditions</h3>
            <div className="space-y-6">
              <Field label="Soil type">
                <SoilTypeSelector 
                  value={form.soil_type} 
                  onChange={(val) => updateField("soil_type", val)} 
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Section 2: Targets & Strategy */}
        <div className="space-y-10">
          <Field label="Target certifications (All evaluated by default)">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {baseCertifications.map((option) => {
                  const active = form.certifications.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleCertification(option)}
                      className={`rounded-full border px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all ${
                        active ? "border-accent bg-accent text-bg" : "border-white/10 text-white/40 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              
              {form.certifications.includes("LEED") && (
                <div className="flex flex-col gap-3 animate-reveal">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">LEED Certification Level</span>
                  <LeedLevelSelector 
                    value={form.leed_level} 
                    onChange={(val) => updateField("leed_level", val)} 
                  />
                </div>
              )}
            </div>
          </Field>
          
          <Field label="Priority ranking">
            <Input value={form.priority_ranking} onChange={(event) => updateField("priority_ranking", event.target.value)} placeholder="e.g. Carbon > Cost > Speed" />
          </Field>
          
          <Field label="Carbon reduction target">
            <Input value={form.carbon_reduction_target} onChange={(event) => updateField("carbon_reduction_target", event.target.value)} placeholder="e.g. 40% reduction vs baseline" />
          </Field>

          <Field label="Strategic design brief">
            <textarea
              rows="8"
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              className="w-full rounded-[32px] border border-white/10 bg-white/5 px-8 py-6 text-white outline-none transition-all focus:border-accent focus:bg-white/10 leading-relaxed"
              placeholder="Detail your sustainability priorities..."
            />
          </Field>
        </div>
      </div>

      <div className="mt-16 border-t border-white/5 pt-10">
        <MaterialsAdminPanel
          catalog={catalog}
          error={catalogError}
          loading={catalogLoading}
          onUpload={onUploadCatalog}
          onReset={onResetCatalog}
          uploadLoading={catalogUploadLoading}
        />
      </div>

      <div className="mt-16 pt-10 border-t border-white/5">
        <button
          type="button"
          onClick={() => onSubmit(form)}
          disabled={loading}
          className="w-full rounded-full bg-white/90 px-10 py-6 text-[12px] font-black uppercase tracking-[0.3em] text-bg transition-all hover:bg-white hover:scale-[1.01] active:scale-[0.99] disabled:cursor-wait disabled:opacity-50 shadow-2xl"
        >
          {loading ? "Synthesizing Architecture..." : "Analyze with Gemini 2.5 Flash"}
        </button>
      </div>
    </section>
  );
}

function LocationSelector({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-full border border-white/10 bg-white/5 px-6 py-4 text-left text-white outline-none transition-all hover:bg-white/10 focus:border-accent"
      >
        <span className={value ? "text-white" : "text-white/20"}>{value || "Select a location"}</span>
        <div className={`h-1 w-1 rounded-full bg-accent transition-all duration-300 ${isOpen ? "scale-[3]" : "scale-100"}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-3 max-h-[320px] overflow-y-auto rounded-[32px] border border-white/10 bg-[#0e1210]/95 p-4 shadow-2xl animate-reveal custom-scrollbar backdrop-blur-xl">
            {locationOptions.map((group) => (
              <div key={group.group} className="mb-6 last:mb-0">
                <div className="px-4 mb-3 text-[9px] font-black uppercase tracking-[0.3em] text-accent/40">{group.group}</div>
                <div className="space-y-1">
                  {group.places.map((place) => (
                    <button
                      key={place}
                      type="button"
                      onClick={() => {
                        onChange(place);
                        setIsOpen(false);
                      }}
                      className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition-all hover:bg-white/5 ${
                        value === place ? "bg-accent/10 text-accent font-bold" : "text-white/60 hover:text-white"
                      }`}
                    >
                      {place}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SoilTypeSelector({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-full border border-white/10 bg-white/5 px-6 py-4 text-left text-white outline-none transition-all hover:bg-white/10 focus:border-accent"
      >
        <span className={value ? "text-white" : "text-white/20"}>{value || "Select a soil type"}</span>
        <div className={`h-1 w-1 rounded-full bg-accent transition-all duration-300 ${isOpen ? "scale-[3]" : "scale-100"}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-3 max-h-[320px] overflow-y-auto rounded-3xl border border-white/10 bg-[#0e1210]/95 p-2 shadow-2xl animate-reveal custom-scrollbar backdrop-blur-xl">
            {soilOptions.map((soil) => (
              <button
                key={soil}
                type="button"
                onClick={() => {
                  onChange(soil);
                  setIsOpen(false);
                }}
                className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition-all hover:bg-white/5 ${
                  value === soil ? "bg-accent/10 text-accent font-bold" : "text-white/60 hover:text-white"
                }`}
              >
                {soil}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LeedLevelSelector({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-full border border-white/10 bg-white/5 px-6 py-4 text-left text-white outline-none transition-all hover:bg-white/10 focus:border-accent"
      >
        <span className={value ? "text-white" : "text-white/20"}>{value || "Select Level"}</span>
        <div className={`h-1 w-1 rounded-full bg-accent transition-all duration-300 ${isOpen ? "scale-[3]" : "scale-100"}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-3 max-h-[320px] overflow-y-auto rounded-3xl border border-white/10 bg-[#0e1210]/95 p-2 shadow-2xl animate-reveal custom-scrollbar backdrop-blur-xl">
            {leedLevelOptions.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => {
                  onChange(level);
                  setIsOpen(false);
                }}
                className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition-all hover:bg-white/5 ${
                  value === level ? "bg-accent/10 text-accent font-bold" : "text-white/60 hover:text-white"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-4 block text-[10px] font-black uppercase tracking-[0.3em] text-white/30">{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-4 text-white outline-none transition-all focus:border-accent focus:bg-white/10 placeholder:text-white/20"
    />
  );
}
