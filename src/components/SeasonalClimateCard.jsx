const SEASONS = [
  { key: "summer", label: "☀ Summer", metric: "temperature" },
  { key: "monsoon", label: "🌧 Monsoon", metric: "rain" },
  { key: "winter", label: "❄ Winter", metric: "temperature" },
];

function formatRounded(value, suffix) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return `${Math.round(value)}${suffix}`;
}

function formatPrimaryMetric(seasonKey, seasonData) {
  if (seasonKey === "monsoon") {
    return formatRounded(seasonData?.precipitation_mm, " mm rain");
  }
  return formatRounded(seasonData?.temperature_c, "°C");
}

function formatHumidity(seasonData) {
  const value = formatRounded(seasonData?.humidity_pct, "% humidity");
  return value === "--" ? "--" : value;
}

function hasSeasonalProfile(seasonalProfile) {
  return seasonalProfile && typeof seasonalProfile === "object" && Object.keys(seasonalProfile).length > 0;
}

export function SeasonalClimateCard({ climate, className = "", compact = false }) {
  const seasonalProfile = climate?.seasonal_profile;

  if (!hasSeasonalProfile(seasonalProfile)) {
    return (
      <div className={`rounded-3xl border border-accent/20 bg-accent/5 p-6 ${className}`.trim()}>
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">SEASONAL CLIMATE</p>
        <p className="mt-3 text-sm font-medium text-white/50">Seasonal climate profile unavailable</p>
      </div>
    );
  }

  return (
    <div className={`rounded-[32px] border border-accent/20 bg-accent/5 p-6 md:p-8 ${className}`.trim()}>
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">SEASONAL CLIMATE</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Open-Meteo Climate Profile</p>
      </div>
      <div className={`mt-6 grid gap-4 ${compact ? "md:grid-cols-3" : "lg:grid-cols-3"}`}>
        {SEASONS.map((season) => {
          const seasonData = seasonalProfile?.[season.key];
          return (
            <div key={season.key} className="rounded-[24px] border border-white/8 bg-black/15 p-5">
              <p className="text-sm font-semibold text-white">{season.label}</p>
              <p className="mt-4 font-heading text-3xl tracking-tight text-white">
                {formatPrimaryMetric(season.key, seasonData)}
              </p>
              <p className="mt-2 text-sm font-medium text-white/45">{formatHumidity(seasonData)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function seasonalClimateInsights(climate) {
  if (Array.isArray(climate?.climate_risks) && climate.climate_risks.length > 0) {
    return climate.climate_risks.map((risk) => `${capitalize(risk)} resilience should be prioritized across the shortlisted materials.`);
  }

  const seasonalProfile = climate?.seasonal_profile;
  if (hasSeasonalProfile(seasonalProfile)) {
    const derived = SEASONS.flatMap((season) => {
      const riskTags = seasonalProfile?.[season.key]?.risk_tags;
      if (!Array.isArray(riskTags) || riskTags.length === 0) {
        return [];
      }
      return [`${capitalize(season.key)} focuses on ${riskTags.map(capitalize).join(", ")} resilience.`];
    });
    if (derived.length > 0) {
      return derived;
    }
  }

  return Array.isArray(climate?.next_days_summary) ? climate.next_days_summary : [];
}

function capitalize(value) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}
