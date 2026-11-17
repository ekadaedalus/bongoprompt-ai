export type StepStatus = "pending" | "done" | "failed" | "skipped";

export interface PlanStep {
  id: string;
  label: string;
  status: StepStatus;
  note?: string;
}

/** Live list of the planner's real steps, ticked as the server reports each one finished. */
export default function ProgressChecklist({ steps }: { steps: PlanStep[] }) {
  const firstPending = steps.findIndex((s) => s.status === "pending");

  return (
    <div className="w-full max-w-3xl mx-auto mb-8 animate-in fade-in duration-300">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-white/50 p-6 shadow-2xl" aria-live="polite">
        <ul className="space-y-3">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3">
              <span
                className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                  s.status === "done"
                    ? "bg-green-500 text-white"
                    : s.status === "pending"
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {s.status === "done" ? "✓" : s.status === "pending" ? (
                  <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : "–"}
              </span>
              <span
                className={`font-semibold ${
                  s.status === "done" ? "text-slate-800" : s.status === "pending" ? (i === firstPending ? "text-slate-800" : "text-slate-500") : "text-slate-400"
                }`}
              >
                {s.label}
                {s.status === "failed" && <span className="ml-2 text-xs font-normal">(unavailable right now)</span>}
                {s.status === "skipped" && <span className="ml-2 text-xs font-normal">({s.note ?? "not needed for this trip"})</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Skeleton cards hint at what's coming */}
      <div className="space-y-4 mt-6" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-white/50 p-6 shadow-xl animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
              <div className="w-20 h-8 bg-slate-200 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
