"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { TripRecord } from "@/lib/types";
import { plural, shortDate, taka } from "@/lib/format";
import SourceTag from "./SourceTag";

const BOOK_SITE = { Train: "Bangladesh Railway", Bus: "Shohoz", Flight: "airline site" } as const;

function summaryText(trip: TripRecord): string {
  const r = trip.request;
  const lines = [
    `🧳 My BongoPrompt trip ${trip.id}`,
    `📍 ${r.origin} → ${r.destination}`,
    `📅 ${shortDate(r.checkinDate)} – ${shortDate(r.checkoutDate)} (${plural(r.nights, "night")}, ${plural(r.travellers, "traveller")})`,
    `${trip.transport.type === "Train" ? "🚆" : trip.transport.type === "Flight" ? "✈️" : "🚌"} ${trip.transport.provider} · ${taka(trip.costs.transport)}`,
    `🏨 ${trip.hotel.name} · ${taka(trip.costs.hotel)}`,
  ];
  if (trip.guide) lines.push(`🧭 Guide: ${trip.guide.name} (${trip.guideHours} h) · ${taka(trip.costs.guide)}`);
  lines.push(`💰 Total estimate: ${taka(trip.costs.total)}`);
  return lines.join("\n");
}

/** The success screen: a shareable trip pass, the day-by-day plan and booking links. */
export default function TripPass({ trip, onHome }: { trip: TripRecord; onHome: () => void }) {
  const passRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const r = trip.request;

  useEffect(() => {
    QRCode.toDataURL(trip.id, { margin: 1, width: 240, color: { dark: "#1e293b", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [trip.id]);

  const downloadPass = async () => {
    if (!passRef.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(passRef.current, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `bongoprompt-${trip.id}.png`;
      a.click();
    } catch (err) {
      console.error("Pass download failed:", err);
      alert("Sorry, the pass image couldn't be created in this browser.");
    } finally {
      setDownloading(false);
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(summaryText(trip))}`;
  const transportIcon = trip.transport.type === "Train" ? "🚆" : trip.transport.type === "Flight" ? "✈️" : "🚌";

  return (
    <div className="w-full max-w-2xl mx-auto animate-in zoom-in-95 duration-500 space-y-6">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl border-2 border-green-400 p-8 shadow-2xl text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-2 bg-gradient-to-r from-transparent via-green-500 to-transparent"></div>

        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-3xl font-bold mb-2 text-slate-800">Plan confirmed!</h2>
        <p className="text-slate-600 mb-6">Saved to <span className="font-semibold">My trips</span>. Book each part with the provider using the links below.</p>

        {/* The pass: this exact card is what gets saved as a PNG */}
        <div ref={passRef} className="bg-white rounded-2xl p-6 border-2 border-dashed border-slate-300 text-left">
          <div className="flex items-start justify-between gap-4 border-b-2 border-slate-200 pb-4 mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-purple-600">BongoPrompt trip pass</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{r.origin} → {r.destination}</p>
              <p className="text-sm text-slate-600 mt-1">
                📅 {shortDate(r.checkinDate)} – {shortDate(r.checkoutDate)} · 🌙 {plural(r.nights, "night")} · 👥 {plural(r.travellers, "traveller")}
              </p>
              <p className="font-mono text-sm font-bold text-slate-800 mt-2">#{trip.id}</p>
            </div>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element -- generated data URL
              <img src={qr} alt={`QR code for trip ${trip.id}`} className="w-24 h-24 rounded-lg border-2 border-slate-200 flex-shrink-0" />
            )}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between gap-4">
              <span className="text-slate-600 text-sm font-semibold">{transportIcon} {trip.transport.type}</span>
              <span className="text-slate-800 text-sm font-bold text-right">
                {trip.transport.provider}
                {trip.transport.fares?.find((f) => f.cls === trip.transport.fare_class) && ` · ${trip.transport.fares.find((f) => f.cls === trip.transport.fare_class)!.label}`}
                {" "}({taka(trip.costs.transport)})
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-600 text-sm font-semibold">🏨 Hotel</span>
              <span className="text-slate-800 text-sm font-bold text-right">{trip.hotel.name} ({taka(trip.costs.hotel)})</span>
            </div>
            {trip.guide && (
              <div className="flex justify-between gap-4 text-purple-600">
                <span className="text-sm font-semibold">🧭 Local Guide</span>
                <span className="text-sm font-bold text-right">
                  {trip.guide.name} · {trip.guideHours} h ({taka(trip.costs.guide)}){trip.guide.kind === "sample" ? " · request only" : ""}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-slate-200 pt-3 mt-3">
              <span className="text-slate-800 font-bold text-lg">Total Estimated</span>
              <span className="text-green-600 font-bold text-2xl">{taka(trip.costs.total)}</span>
            </div>
          </div>
        </div>

        {trip.guide?.kind === "registered" && trip.guide.phone && (
          <p className="mt-4 text-sm text-slate-700 bg-blue-50 border-2 border-blue-100 rounded-xl px-4 py-2">
            📞 Contact your guide {trip.guide.name} on <a className="font-bold text-blue-700" href={`tel:${trip.guide.phone}`}>{trip.guide.phone}</a> to confirm the date and time.
          </p>
        )}
        {trip.guide?.kind === "sample" && (
          <p className="mt-4 text-xs text-slate-500">Guide booking is launching soon. The guide cost is an estimate only, and nothing has been booked.</p>
        )}

        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          <button onClick={downloadPass} disabled={downloading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50">
            {downloading ? "Preparing…" : "⬇️ Download pass"}
          </button>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all">
            💬 Share on WhatsApp
          </a>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {trip.transport.booking_url && (
            <a href={trip.transport.booking_url} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-white border-2 border-slate-200 hover:border-purple-400 text-sm font-bold text-slate-700 transition-colors">
              {transportIcon} Book on {trip.transport.type === "Flight" ? trip.transport.provider : BOOK_SITE[trip.transport.type]} ↗
            </a>
          )}
          {trip.hotel.bookingUrl && (
            <a href={trip.hotel.bookingUrl} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-white border-2 border-slate-200 hover:border-purple-400 text-sm font-bold text-slate-700 transition-colors">
              🏨 Book on Agoda ↗
            </a>
          )}
        </div>
      </div>

      {/* Day-by-day plan */}
      {trip.itinerary.length > 0 && (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl border-2 border-white/50 p-8 shadow-2xl text-left">
          <div className="flex items-center justify-between gap-2 mb-6">
            <h3 className="text-2xl font-bold text-slate-800">🗓️ Day-by-day plan</h3>
            <SourceTag source="ai" label="AI suggestion" />
          </div>
          <ol className="relative border-l-4 border-purple-200 ml-3 space-y-8">
            {trip.itinerary.map((d) => (
              <li key={d.day} className="pl-6 relative">
                <span className="absolute -left-[22px] top-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold flex items-center justify-center border-4 border-white shadow-lg">
                  {d.day}
                </span>
                <p className="font-bold text-slate-800 mb-2 pt-2">Day {d.day}</p>
                <div className="grid gap-1.5 text-sm text-slate-700">
                  {d.morning && <p><span className="font-semibold">🌅 Morning:</span> {d.morning}</p>}
                  {d.afternoon && <p><span className="font-semibold">☀️ Afternoon:</span> {d.afternoon}</p>}
                  {d.evening && <p><span className="font-semibold">🌙 Evening:</span> {d.evening}</p>}
                  {d.food && <p className="text-purple-700"><span className="font-semibold">🍛 Try:</span> {d.food}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <button
        onClick={onHome}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl text-lg shadow-lg transition-all"
      >
        Back to Homepage
      </button>
    </div>
  );
}
