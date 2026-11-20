import { taka } from "@/lib/format";

interface Props {
  budget: number | null;
  items: { label: string; amount: number }[];
}

/**
 * Sticky running total: fills as a ride, hotel and guide are picked; red when over budget.
 * One compact line under 640px; the full breakdown from `sm` up.
 * Pages showing it need bottom padding (BUDGET_BAR_PADDING) so content can scroll clear of it.
 * Every breakpoint the page sets `p-*` at (here `md:p-8`) needs a matching `pb-*`, or that `p-*` wins.
 */
export const BUDGET_BAR_PADDING = "pb-28 sm:pb-40 md:pb-40";

export default function BudgetBar({ budget, items }: Props) {
  const spent = items.reduce((sum, i) => sum + i.amount, 0);
  const picked = items.filter((i) => i.amount > 0);
  const over = !!budget && spent > budget;
  const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
  const status = budget ? (over ? `${taka(spent - budget)} over` : `${taka(budget - spent)} left`) : "no budget set";

  // A budget of 0 counts as no budget: no "0" rendered, no progress bar with a max of 0.
  const progress = budget ? (
    <div className="h-full rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={spent}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${over ? "bg-red-500" : "bg-gradient-to-r from-blue-600 to-purple-600"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  ) : null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 p-2 sm:p-4 pointer-events-none">
      <div
        className={`pointer-events-auto max-w-4xl mx-auto bg-white/95 backdrop-blur-xl rounded-2xl border-2 shadow-2xl px-4 py-2 sm:px-5 sm:py-3 transition-colors ${
          over ? "border-red-400" : "border-white/50"
        }`}
      >
        {/* Under 640px: one compact line */}
        <div className="flex sm:hidden items-center gap-3 text-sm">
          <p className={`font-bold whitespace-nowrap ${over ? "text-red-600" : "text-slate-800"}`}>
            {taka(spent)}
            {budget ? <span className="text-slate-500 font-semibold"> / {taka(budget)}</span> : null}
          </p>
          {progress && <div className="flex-1 h-2">{progress}</div>}
          <p className={`text-xs font-semibold whitespace-nowrap ${over ? "text-red-600" : "text-slate-600"}`}>{status}</p>
        </div>

        {/* 640px and up: totals, breakdown and a full-width bar */}
        <div className="hidden sm:block">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2">
            <p className={`font-bold text-lg ${over ? "text-red-600" : "text-slate-800"}`}>
              {taka(spent)}{" "}
              <span className="text-slate-500 font-semibold text-sm">{budget ? `of ${taka(budget)}` : "so far"}</span>
              <span className="text-sm font-semibold"> · {status}</span>
            </p>
            <p className="text-xs text-slate-600 font-semibold">
              {picked.length ? picked.map((i) => `${i.label} ${taka(i.amount)}`).join(" + ") : "Pick a ride to start"}
            </p>
          </div>
          {progress && <div className="h-2.5">{progress}</div>}
        </div>
      </div>
    </div>
  );
}
