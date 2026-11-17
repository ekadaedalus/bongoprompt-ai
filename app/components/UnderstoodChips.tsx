"use client";
import { useState } from "react";
import type { TripRequest } from "@/lib/types";
import { plural, shortDate, taka } from "@/lib/format";

type Field = "route" | "dates" | "nights" | "travellers" | "budget";

interface Props {
  request: TripRequest;
  disabled?: boolean;
  /** Called with the edited request; the page re-runs the search with it. */
  onRerun: (edited: Partial<TripRequest>) => void;
}

const inputClass =
  "w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all";

/** "Here's what I understood" chips. Clicking one opens a small editor that re-runs the search. */
export default function UnderstoodChips({ request, disabled, onRerun }: Props) {
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState(request);

  const open = (field: Field) => {
    if (disabled) return;
    setDraft(request);
    setEditing(editing === field ? null : field);
  };

  const apply = () => {
    const edited: Partial<TripRequest> = { ...draft };
    // Nights or check-in changed: let the server recompute check-out from them.
    if (editing === "nights" || editing === "dates") edited.checkoutDate = undefined;
    if (editing === "travellers") edited.rooms = undefined;
    setEditing(null);
    onRerun(edited);
  };

  const chips: { field: Field; label: string }[] = [
    { field: "route", label: `📍 ${request.origin ?? "Where from?"} → ${request.destination}` },
    { field: "dates", label: `📅 ${shortDate(request.checkinDate)} – ${shortDate(request.checkoutDate)}` },
    { field: "nights", label: `🌙 ${plural(request.nights, "night")}` },
    { field: "travellers", label: `👥 ${plural(request.travellers, "traveller")}` },
    {
      field: "budget",
      label: request.total_budget
        ? `💰 ${taka(request.total_budget)} (${taka(request.transport_budget)} travel / ${taka(request.hotel_budget)} hotel)`
        : "💰 Add a budget",
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto mb-6 animate-in fade-in duration-300">
      <p className="text-center text-white/90 text-xs font-semibold uppercase tracking-wider mb-2" style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}>
        Here&apos;s what I understood · click to edit
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {chips.map((c) => (
          <button
            key={c.field}
            type="button"
            onClick={() => open(c.field)}
            disabled={disabled}
            className={`px-4 py-2 rounded-full text-sm font-bold shadow-lg border-2 transition-all disabled:opacity-60 ${
              editing === c.field
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white border-white/50"
                : `bg-white/95 text-slate-700 border-white/50 hover:bg-white ${c.field === "route" && request.needs_origin ? "ring-2 ring-yellow-400" : ""}`
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          className="mt-3 bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-white/50 p-4 shadow-2xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-end animate-in slide-in-from-top-2 duration-200"
        >
          {editing === "route" && (
            <>
              <label className="flex-1 text-sm font-semibold text-slate-700">
                From
                <input className={inputClass} value={draft.origin ?? ""} placeholder="e.g. Dhaka" required
                  onChange={(e) => setDraft({ ...draft, origin: e.target.value })} />
              </label>
              <label className="flex-1 text-sm font-semibold text-slate-700">
                To
                <input className={inputClass} value={draft.destination ?? ""} placeholder="e.g. Sylhet" required
                  onChange={(e) => setDraft({ ...draft, destination: e.target.value })} />
              </label>
            </>
          )}
          {editing === "dates" && (
            <>
              <label className="flex-1 text-sm font-semibold text-slate-700">
                Check-in
                <input type="date" className={inputClass} value={draft.checkinDate} required
                  onChange={(e) => setDraft({ ...draft, checkinDate: e.target.value })} />
              </label>
              <label className="sm:w-32 text-sm font-semibold text-slate-700">
                Nights
                <input type="number" min={1} max={30} className={inputClass} value={draft.nights} required
                  onChange={(e) => setDraft({ ...draft, nights: Number(e.target.value) })} />
              </label>
            </>
          )}
          {editing === "nights" && (
            <label className="flex-1 text-sm font-semibold text-slate-700">
              Nights
              <input type="number" min={1} max={30} className={inputClass} value={draft.nights} required
                onChange={(e) => setDraft({ ...draft, nights: Number(e.target.value) })} />
            </label>
          )}
          {editing === "travellers" && (
            <label className="flex-1 text-sm font-semibold text-slate-700">
              Travellers
              <input type="number" min={1} max={20} className={inputClass} value={draft.travellers} required
                onChange={(e) => setDraft({ ...draft, travellers: Number(e.target.value) })} />
            </label>
          )}
          {editing === "budget" && (
            <label className="flex-1 text-sm font-semibold text-slate-700">
              Total budget (৳) · split 30% travel / 70% hotel
              <input type="number" min={500} step={500} className={inputClass} value={draft.total_budget ?? ""} placeholder="e.g. 15000" required
                onChange={(e) => setDraft({ ...draft, total_budget: Number(e.target.value) })} />
            </label>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(null)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all">
              Cancel
            </button>
            <button type="submit"
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg transition-all">
              Update plan
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
