import type { DataSource } from "@/lib/types";

const TAGS: Record<DataSource, { label: string; className: string }> = {
  agoda: { label: "Live · Agoda", className: "bg-green-100 text-green-700 border-green-200" },
  railway: { label: "Bangladesh Railway", className: "bg-purple-100 text-purple-700 border-purple-200" },
  openmeteo: { label: "Open-Meteo", className: "bg-sky-100 text-sky-700 border-sky-200" },
  wikipedia: { label: "Wikipedia", className: "bg-slate-100 text-slate-600 border-slate-200" },
  ai: { label: "AI estimate", className: "bg-amber-100 text-amber-700 border-amber-200" },
  bongoprompt: { label: "✓ Verified guide", className: "bg-green-100 text-green-700 border-green-200" },
};

/** Small pill saying where a listing's data came from. */
export default function SourceTag({ source, label }: { source: DataSource; label?: string }) {
  const tag = TAGS[source];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap ${tag.className}`}
    >
      {label ?? tag.label}
    </span>
  );
}
