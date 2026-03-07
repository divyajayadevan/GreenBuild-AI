import { useState } from "react";

export function MaterialsAdminPanel({ catalog, error, loading, onUpload, uploadLoading }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState("");

  async function handleUpload() {
    if (!selectedFile) return;
    setMessage("");
    try {
      const response = await onUpload(selectedFile);
      setMessage(`Loaded ${response.filename} with ${response.row_count} materials.`);
      setSelectedFile(null);
    } catch (uploadError) {
      setMessage(uploadError.message || "Upload failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-accent">Catalog Admin</p>
          <h3 className="mt-2 font-heading text-2xl tracking-tight text-white">Materials CSV Database</h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
        <div className="space-y-4">
          <StatCard label="Rows Loaded" value={loading ? "..." : String(catalog?.row_count ?? 0)} />
          <StatCard label="Regions" value={loading ? "..." : String(catalog?.regions?.length ?? 0)} />
          <StatCard label="Active File" value={loading ? "..." : catalog?.filename || "Unavailable"} compact />
        </div>

        <div className="space-y-4">
          <Field label="Replace Catalog CSV">
            <label className="block cursor-pointer">
              <div className="flex w-full items-center justify-between rounded-full border border-white/10 bg-white/5 px-6 py-4 text-left text-white transition-all hover:bg-white/10">
                <span className={`truncate pr-4 ${selectedFile ? "text-white" : "text-white/20"}`}>
                  {selectedFile ? selectedFile.name : "Choose a materials CSV"}
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Browse</span>
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
            </label>
          </Field>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploadLoading}
            className="rounded-full border border-white/10 bg-white/5 px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-white transition-all hover:border-accent/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploadLoading ? "Uploading..." : "Upload Catalog"}
          </button>

          {(message || error) && (
            <div className="rounded-[24px] border border-accent/20 bg-accent/5 px-5 py-4 text-sm leading-relaxed text-white/70">
              {message || error}
            </div>
          )}
        </div>
      </div>
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

function StatCard({ label, value, compact = false }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-4">
      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/20">{label}</p>
      <p className={`mt-2 font-heading tracking-tight text-white ${compact ? "text-lg" : "text-2xl"}`}>{value}</p>
    </div>
  );
}
