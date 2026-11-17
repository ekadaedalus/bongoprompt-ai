import type { Weather } from "@/lib/types";
import { shortDate } from "@/lib/format";
import SourceTag from "./SourceTag";

/** WMO weather code → emoji (https://open-meteo.com/en/docs#weathervariables). */
function icon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧️";
  return "⛈️";
}

/** Compact day-by-day forecast for the trip dates plus one helpful line. */
export default function WeatherStrip({ weather }: { weather: Weather }) {
  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-white/50 p-4 shadow-xl">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-bold text-slate-800">🌦️ Weather for your trip</h3>
        <SourceTag source="openmeteo" />
      </div>
      {weather.status === "too_far" ? (
        <p className="text-slate-600 text-sm">📅 Forecast available closer to your trip (up to 16 days ahead).</p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weather.days.map((d, i) => (
              <div key={d.date} className="flex-shrink-0 min-w-[92px] bg-slate-50 rounded-xl border-2 border-slate-200 px-3 py-2 text-center">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Day {i + 1}</p>
                <p className="text-xs text-slate-600">{shortDate(d.date)}</p>
                <p className="text-2xl my-1" aria-hidden="true">{icon(d.code)}</p>
                <p className="text-sm font-bold text-slate-800">
                  {Math.round(d.max)}° <span className="text-slate-500 font-semibold">{Math.round(d.min)}°</span>
                </p>
                <p className={`text-xs font-semibold ${d.rain >= 50 ? "text-blue-600" : "text-slate-500"}`}>💧 {d.rain}%</p>
                <p className="text-[10px] text-slate-500 mt-1">🌅 {d.sunrise} · 🌇 {d.sunset}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold text-purple-700 bg-purple-50 rounded-lg px-3 py-2">{weather.tip}</p>
        </>
      )}
    </div>
  );
}
