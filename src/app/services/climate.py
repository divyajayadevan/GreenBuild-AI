from typing import Any

import httpx


class ClimateService:
    def __init__(self) -> None:
        self.geocode_url = "https://geocoding-api.open-meteo.com/v1/search"
        self.forecast_url = "https://api.open-meteo.com/v1/forecast"

    def fetch_climate(self, location: str) -> dict[str, Any]:
        try:
            # Detect country hint (e.g., "Kochi, India")
            country_hint = None
            search_query = location
            if "," in location:
                parts = [p.strip() for p in location.split(",")]
                search_query = parts[0]
                country_hint = parts[-1].lower()

            with httpx.Client(timeout=20.0) as client:
                geo_response = client.get(
                    self.geocode_url,
                    params={"name": search_query, "count": 10, "language": "en", "format": "json"},
                )
                geo_response.raise_for_status()
                geo_data = geo_response.json()
                results = geo_data.get("results") or []
                if not results:
                    raise ValueError(f"Location not found: {location}")

                # Prioritize based on country hint
                place = results[0]
                if country_hint:
                    for r in results:
                        if country_hint in r.get("country", "").lower():
                            place = r
                            break
                
                latitude = place["latitude"]
                longitude = place["longitude"]
                forecast_response = client.get(
                    self.forecast_url,
                    params={
                        "latitude": latitude,
                        "longitude": longitude,
                        "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
                        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max",
                        "forecast_days": 3,
                        "timezone": "auto",
                    },
                )
                forecast_response.raise_for_status()
                forecast = forecast_response.json()
                current = forecast.get("current", {})
                daily = forecast.get("daily", {})
                next_days_summary = []
                times = daily.get("time", [])
                maxes = daily.get("temperature_2m_max", [])
                mins = daily.get("temperature_2m_min", [])
                rain = daily.get("precipitation_sum", [])
                uv = daily.get("uv_index_max", [])
                for index, day in enumerate(times):
                    next_days_summary.append(
                        f"{day}: {mins[index]}-{maxes[index]}C, rain {rain[index]}mm, UV {uv[index]}"
                    )

                seasonal_profile = self._seasonal_profile(
                    place.get("country", ""),
                    latitude,
                    {
                        "temperature_c": current.get("temperature_2m", 24),
                        "temp_max": daily.get("temperature_2m_max", [28])[0],
                        "temp_min": daily.get("temperature_2m_min", [18])[0],
                        "wind_speed_kph": current.get("wind_speed_10m", 10),
                        "precipitation_mm": current.get("precipitation", 0),
                        "humidity_pct": current.get("relative_humidity_2m", 50),
                    },
                )

                return {
                    "location_label": f"{place['name']}, {place.get('country', '')}".strip(", "),
                    "latitude": latitude,
                    "longitude": longitude,
                    "temperature_c": current.get("temperature_2m", 24),
                    "temp_max": daily.get("temperature_2m_max", [28])[0],
                    "temp_min": daily.get("temperature_2m_min", [18])[0],
                    "wind_speed_kph": current.get("wind_speed_10m", 10),
                    "precipitation_mm": current.get("precipitation", 0),
                    "humidity_pct": current.get("relative_humidity_2m", 50),
                    "next_days_summary": next_days_summary,
                    "seasonal_profile": seasonal_profile,
                    "climate_risks": self._climate_risks(seasonal_profile),
                    "source": "Open-Meteo Global Forecasting",
                    "basis": "Daily Extremes (Design Basis)",
                }
        except Exception:
            seasonal_profile = self._seasonal_profile(
                location,
                0,
                {
                    "temperature_c": 24,
                    "temp_max": 28,
                    "temp_min": 18,
                    "wind_speed_kph": 12,
                    "precipitation_mm": 1,
                    "humidity_pct": 56,
                },
            )
            return {
                "location_label": location,
                "latitude": 0,
                "longitude": 0,
                "temperature_c": 24,
                "wind_speed_kph": 12,
                "precipitation_mm": 1,
                "humidity_pct": 56,
                "next_days_summary": [
                    "Fallback climate profile generated locally.",
                    "Assume moderate heat loading and seasonal precipitation.",
                    "Prioritize resilient envelopes and low-carbon MEP choices.",
                ],
                "seasonal_profile": seasonal_profile,
                "climate_risks": self._climate_risks(seasonal_profile),
            }

    def _seasonal_profile(self, country: str, latitude: float, current: dict[str, Any]) -> dict[str, dict[str, Any]]:
        hemisphere = "north" if latitude >= 0 else "south"
        temp = float(current.get("temperature_c", 24))
        temp_max = float(current.get("temp_max", temp + 4))
        temp_min = float(current.get("temp_min", temp - 4))
        humidity = float(current.get("humidity_pct", 56))
        wind = float(current.get("wind_speed_kph", 12))
        precipitation = float(current.get("precipitation_mm", 1))
        monsoon_active = self._is_monsoon_region(country)

        if hemisphere == "north":
            summer = {
                "season": "summer",
                "temperature_c": round(max(temp_max, temp + 4), 1),
                "humidity_pct": round(min(92, humidity + 8), 1),
                "precipitation_mm": round(max(precipitation * 1.5, 4), 1),
                "wind_speed_kph": round(max(wind, 14), 1),
            }
            winter = {
                "season": "winter",
                "temperature_c": round(max(temp_min - 6, -5), 1),
                "humidity_pct": round(max(humidity - 10, 35), 1),
                "precipitation_mm": round(max(precipitation * 0.6, 1), 1),
                "wind_speed_kph": round(max(wind * 0.9, 8), 1),
            }
        else:
            summer = {
                "season": "summer",
                "temperature_c": round(max(temp_max + 1, temp + 3), 1),
                "humidity_pct": round(min(92, humidity + 6), 1),
                "precipitation_mm": round(max(precipitation * 1.2, 3), 1),
                "wind_speed_kph": round(max(wind, 13), 1),
            }
            winter = {
                "season": "winter",
                "temperature_c": round(max(temp_min - 3, 4), 1),
                "humidity_pct": round(max(humidity - 8, 38), 1),
                "precipitation_mm": round(max(precipitation * 0.7, 1), 1),
                "wind_speed_kph": round(max(wind * 0.9, 8), 1),
            }

        monsoon = {
            "season": "monsoon",
            "temperature_c": round(max(temp, 24) if monsoon_active else max(temp - 1, 18), 1),
            "humidity_pct": round(88 if monsoon_active else min(78, humidity + 10), 1),
            "precipitation_mm": round(max(precipitation * (6 if monsoon_active else 2.5), 12 if monsoon_active else 6), 1),
            "wind_speed_kph": round(max(wind * (1.4 if monsoon_active else 1.2), 18 if monsoon_active else 14), 1),
        }

        return {
            "summer": {**summer, "risk_tags": self._season_risk_tags(summer)},
            "monsoon": {**monsoon, "risk_tags": self._season_risk_tags(monsoon)},
            "winter": {**winter, "risk_tags": self._season_risk_tags(winter)},
        }

    def _is_monsoon_region(self, country: str) -> bool:
        normalized = country.strip().lower()
        return normalized in {
            "india",
            "bangladesh",
            "sri lanka",
            "nepal",
            "bhutan",
            "pakistan",
            "myanmar",
            "thailand",
            "vietnam",
            "philippines",
            "indonesia",
            "malaysia",
        }

    def _season_risk_tags(self, season: dict[str, Any]) -> list[str]:
        tags: list[str] = []
        if float(season.get("temperature_c", 0)) >= 32:
            tags.append("heat")
        if float(season.get("humidity_pct", 0)) >= 75:
            tags.append("humidity")
        if float(season.get("precipitation_mm", 0)) >= 12:
            tags.append("rain")
        if float(season.get("wind_speed_kph", 0)) >= 20:
            tags.append("wind")
        if float(season.get("temperature_c", 0)) <= 8:
            tags.append("cold")
        return tags

    def _climate_risks(self, seasonal_profile: dict[str, dict[str, Any]]) -> list[str]:
        risks: set[str] = set()
        for season in seasonal_profile.values():
            risks.update(season.get("risk_tags", []))
        return sorted(risks)
