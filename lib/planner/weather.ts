import type { TripRequest, Weather, WeatherDay } from "../types";
import { daysBetween, todayInDhaka } from "./groq";

/** Open-Meteo: free, keyless forecasts up to 16 days ahead. */
const FORECAST_DAYS = 16;

/** Spellings Open-Meteo's geocoder knows for places it misses. */
const GEO_ALIASES: Record<string, string> = {
  sreemangal: "Srimangal",
  sundarbans: "Mongla",
  "sajek valley": "Sajek",
};

export async function geocode(place: string, signal: AbortSignal): Promise<{ lat: number; lon: number } | null> {
  const name = GEO_ALIASES[place.trim().toLowerCase()] ?? place;
  const params = new URLSearchParams({ name, count: "1", countryCode: "BD", language: "en" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal });
  if (!res.ok) throw new Error(`Open-Meteo geocoding failed (${res.status})`);
  const hit = (await res.json()).results?.[0];
  return hit ? { lat: hit.latitude, lon: hit.longitude } : null;
}

function tipFor(days: WeatherDay[]): string {
  const wettest = days.reduce((a, b) => (b.rain > a.rain ? b : a));
  const hottest = days.reduce((a, b) => (b.max > a.max ? b : a));
  const coldest = days.reduce((a, b) => (b.min < a.min ? b : a));
  const dayNo = (d: WeatherDay) => days.indexOf(d) + 1;

  if (wettest.rain >= 50) return `Day ${dayNo(wettest)}: ${wettest.rain}% chance of rain, pack an umbrella ☔`;
  if (hottest.max >= 34) return `Day ${dayNo(hottest)}: up to ${Math.round(hottest.max)}°C, carry water and sunscreen 🧴`;
  if (coldest.min <= 12) return `Nights drop to ${Math.round(coldest.min)}°C, bring a warm layer 🧥`;
  return "Pleasant weather for sightseeing 🌤️";
}

export async function getWeather(req: TripRequest, coords: { lat: number; lon: number }, signal: AbortSignal): Promise<Weather> {
  const today = todayInDhaka();
  // Forecast covers today + 15 days; anything later can't be forecast yet.
  if (daysBetween(today, req.checkinDate) >= FORECAST_DAYS) return { status: "too_far" };

  const lastForecastDay = daysBetween(today, req.checkoutDate) >= FORECAST_DAYS
    ? new Date(Date.parse(`${today}T00:00:00Z`) + (FORECAST_DAYS - 1) * 86_400_000).toISOString().slice(0, 10)
    : req.checkoutDate;

  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset",
    timezone: "Asia/Dhaka",
    start_date: req.checkinDate,
    end_date: lastForecastDay,
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!res.ok) throw new Error(`Open-Meteo forecast failed (${res.status})`);
  const d = (await res.json()).daily;

  const days: WeatherDay[] = (d?.time ?? []).map((date: string, i: number) => ({
    date,
    max: d.temperature_2m_max[i],
    min: d.temperature_2m_min[i],
    rain: d.precipitation_probability_max[i] ?? 0,
    code: d.weather_code[i],
    sunrise: String(d.sunrise[i]).slice(11, 16),
    sunset: String(d.sunset[i]).slice(11, 16),
  }));
  if (!days.length) throw new Error("Open-Meteo returned no days");
  return { status: "ok", days, tip: tipFor(days) };
}
