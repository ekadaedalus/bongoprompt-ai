"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Hotel } from "@/lib/types";
import { taka } from "@/lib/format";

/**
 * All hotels pinned on one map. Leaflet + OpenStreetMap tiles: free and keyless
 * (Google's no-key embed can only show a single place). Pins are numbered like the cards.
 */
export default function HotelsMap({ hotels, onPick }: { hotels: Hotel[]; onPick: (hotel: Hotel) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  const pinned = hotels.filter((h) => h.latitude && h.longitude);

  useEffect(() => {
    if (!el.current || !pinned.length) return;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const bounds: [number, number][] = [];
      pinned.forEach((h) => {
        const n = hotels.indexOf(h) + 1;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:30px;height:30px;border-radius:9999px;background:linear-gradient(135deg,#9333ea,#db2777);color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.35)">${n}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const pos: [number, number] = [h.latitude!, h.longitude!];
        bounds.push(pos);
        L.marker(pos, { icon, title: h.name })
          .addTo(map!)
          .bindTooltip(`${n}. ${h.name} · ${taka(h.price)}/night`)
          .on("click", () => pickRef.current(h));
      });
      if (bounds.length === 1) map.setView(bounds[0], 14);
      else map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
    // Re-create the map only when the set of hotels changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotels]);

  if (!pinned.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-white/50 p-3 shadow-xl mb-6">
      <div ref={el} className="h-72 rounded-xl overflow-hidden z-0" aria-label="Map of hotels" />
      <p className="text-xs text-slate-500 mt-2 px-1">Click a numbered pin to open that hotel.</p>
    </div>
  );
}
