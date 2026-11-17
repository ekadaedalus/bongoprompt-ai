// Display helpers shared by the page and its components.

/** ৳4,520 — whole taka with thousands separators. */
export function taka(amount: number | null | undefined): string {
  return `৳${Math.round(amount ?? 0).toLocaleString("en-US")}`;
}

/** "Fri, 20 Nov" from YYYY-MM-DD. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
