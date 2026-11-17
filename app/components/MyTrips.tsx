"use client";
import { useEffect, useState } from "react";
import type { TripRecord, TripStatus } from "@/lib/types";
import { plural, shortDate, taka } from "@/lib/format";

type Filter = "all" | "upcoming" | "completed" | "cancelled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const STATUS_CHIP: Record<TripStatus, { label: string; className: string }> = {
  upcoming: { label: "🗓️ Upcoming", className: "bg-blue-100 text-blue-700 border-blue-200" },
  booked: { label: "🎟️ Booked", className: "bg-purple-100 text-purple-700 border-purple-200" },
  completed: { label: "✅ Completed", className: "bg-green-100 text-green-700 border-green-200" },
  cancelled: { label: "✖ Cancelled", className: "bg-slate-200 text-slate-600 border-slate-300" },
};

/** Which buttons each status offers. "delete" opens the confirmation dialog. */
const ACTIONS: Record<TripStatus, { label: string; to: TripStatus | "delete"; primary?: boolean }[]> = {
  upcoming: [{ label: "Mark as booked", to: "booked", primary: true }, { label: "Cancel trip", to: "cancelled" }],
  booked: [{ label: "Mark as done", to: "completed", primary: true }, { label: "Cancel trip", to: "cancelled" }],
  cancelled: [{ label: "Undo cancel", to: "upcoming", primary: true }, { label: "Delete", to: "delete" }],
  completed: [{ label: "Delete", to: "delete" }],
};

const matches = (filter: Filter, status: TripStatus) =>
  filter === "all" || (filter === "upcoming" ? status === "upcoming" || status === "booked" : status === filter);

/** "My trips" list, opened from the account pill. Clicking a trip reopens its pass. */
export default function MyTrips({ onOpen, onClose }: { onOpen: (trip: TripRecord) => void; onClose: () => void }) {
  const [trips, setTrips] = useState<TripRecord[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TripRecord | null>(null);

  useEffect(() => {
    fetch("/api/trips")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load your trips.");
        setTrips(d.trips);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const setStatus = async (trip: TripRecord, status: TripStatus) => {
    setBusyId(trip.id);
    setError("");
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(trip.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not update the trip.");
      setTrips((prev) => prev?.map((t) => (t.id === trip.id ? d.trip : t)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const deleteTrip = async (trip: TripRecord) => {
    setBusyId(trip.id);
    setError("");
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(trip.id)}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not delete the trip.");
      setTrips((prev) => prev?.filter((t) => t.id !== trip.id) ?? null);
      setConfirmDelete(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const shown = trips?.filter((t) => matches(filter, t.status)) ?? [];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trips-title"
        className="relative bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 pt-8 pb-4 flex items-start justify-between">
          <div>
            <h2 id="trips-title" className="text-2xl font-bold text-slate-800">🧳 My trips</h2>
            <p className="text-slate-500 text-sm mt-1">Plans you&apos;ve confirmed, newest first.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none" aria-label="Close">×</button>
        </div>

        {/* Filter row */}
        <div className="mx-8 mb-4 grid grid-cols-4 bg-slate-100 rounded-xl p-1 text-sm font-bold" role="tablist" aria-label="Filter trips">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`py-2 rounded-lg transition-all ${filter === f.id ? "bg-white text-purple-700 shadow" : "text-slate-500 hover:text-slate-700"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="px-8 pb-8 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {!trips && !error && <p className="text-slate-500 text-sm">Loading…</p>}
          {trips && shown.length === 0 && (
            <p className="text-slate-500 text-sm bg-slate-50 rounded-xl border-2 border-slate-200 p-4 text-center">
              {trips.length === 0 ? "No trips yet. Plan one and confirm it to see it here." : "No trips in this list."}
            </p>
          )}
          {shown.map((t) => {
            const cancelled = t.status === "cancelled";
            const chip = STATUS_CHIP[t.status];
            return (
              <div
                key={t.id}
                className={`rounded-2xl border-2 p-4 transition-all ${
                  cancelled ? "bg-slate-100 border-slate-200 opacity-70" : "bg-slate-50 border-slate-200 hover:border-purple-400 hover:bg-white"
                }`}
              >
                <button onClick={() => onOpen(t)} className="w-full text-left" title="Open trip pass">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className={`font-bold ${cancelled ? "text-slate-500 line-through" : "text-slate-800"}`}>
                        {t.request.origin} → {t.request.destination}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        📅 {shortDate(t.request.checkinDate)} – {shortDate(t.request.checkoutDate)} · {plural(t.request.travellers, "traveller")}
                      </p>
                      <p className="font-mono text-xs text-slate-500 mt-1">#{t.id}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <p className={`font-bold ${cancelled ? "text-slate-500" : "text-green-600"}`}>{taka(t.costs.total)}</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap ${chip.className}`}>
                        {chip.label}
                      </span>
                    </div>
                  </div>
                </button>
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t-2 border-slate-200">
                  {ACTIONS[t.status].map((a) => (
                    <button
                      key={a.label}
                      disabled={busyId === t.id}
                      onClick={() => (a.to === "delete" ? setConfirmDelete(t) : setStatus(t, a.to))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                        a.primary
                          ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow"
                          : a.to === "delete"
                          ? "bg-white border-2 border-red-200 text-red-600 hover:bg-red-50"
                          : "bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* In-page delete confirmation */}
        {confirmDelete && (
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-150">
            <div role="alertdialog" aria-modal="true" aria-labelledby="del-title" className="bg-white rounded-2xl border-2 border-slate-200 shadow-2xl p-6 max-w-sm w-full text-center">
              <div className="text-4xl mb-2">🗑️</div>
              <h3 id="del-title" className="text-lg font-bold text-slate-800">Delete this trip?</h3>
              <p className="text-sm text-slate-600 mt-1">
                {confirmDelete.request.origin} → {confirmDelete.request.destination} (#{confirmDelete.id}) will be removed permanently. This can&apos;t be undone.
              </p>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setConfirmDelete(null)} disabled={busyId === confirmDelete.id}
                  className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all">
                  Keep it
                </button>
                <button onClick={() => deleteTrip(confirmDelete)} disabled={busyId === confirmDelete.id}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">
                  {busyId === confirmDelete.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
