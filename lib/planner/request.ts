import type { TripRequest } from "../types";
import { addDays, daysBetween, groqJson, todayInDhaka } from "./groq";

/** "Tue 2026-11-10, Wed 2026-11-11, …" so the model doesn't have to work out weekdays itself. */
function calendar(today: string, days = 14): string {
  return Array.from({ length: days }, (_, i) => {
    const iso = addDays(today, i);
    const wd = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    return `${wd} ${iso}`;
  }).join(", ");
}

const EXTRACT_PROMPT = (today: string) => `You read travel requests for trips WITHIN BANGLADESH.
The request may be written in English, Bangla (বাংলা) or Banglish.
Today is ${calendar(today, 1)} (Asia/Dhaka). The next two weeks: ${calendar(today)}.`;

const EXTRACT_RULES = `

Return ONLY a JSON object with these keys:
origin, destination, checkinDate, checkoutDate, nights, travellers, rooms, total_budget

RULES:
- Write place names in English with the common spelling. Examples: ঢাকা → "Dhaka", কক্সবাজার → "Cox's Bazar",
  সিলেট → "Sylhet", চট্টগ্রাম → "Chattogram", সাজেক → "Sajek Valley", সুন্দরবন → "Sundarbans",
  শ্রীমঙ্গল → "Sreemangal", বান্দরবান → "Bandarban", রাঙ্গামাটি → "Rangamati", কুয়াকাটা → "Kuakata".
- Convert Bangla digits (০১২৩৪৫৬৭৮৯) to normal digits. "8k" or "৳8k" = 8000. "১৫০০০ টাকা" = 15000.
- origin: where the trip starts, or null if not stated.
- checkinDate / checkoutDate: YYYY-MM-DD. Resolve relative dates ("next Friday", "this weekend", "আগামী শুক্রবার")
  using the calendar above. "Friday" / "next Friday" = the first Friday after today.
  The weekend in Bangladesh is Friday and Saturday: "weekend" = check in on the coming Thursday, check out on Saturday.
  Use null if no date is given.
- nights: "X nights"/"X রাত" → X. "X days"/"X দিন" → X - 1 (at least 1). null if not stated.
- travellers: number of people. "family"/"পরিবার" with no count → 4, "couple"/"with my wife"/"with my husband" → 2,
  "solo"/"alone"/"একা" → 1, "friends"/"বন্ধুরা" with no count → 4. null if not stated.
- rooms: only if stated, else null.
- total_budget: a number in BDT, or null if not stated.
Never invent values that are not in the request; use null instead.`;

/** Turn free text (English or Bangla) into the raw request fields. */
export async function extractRequest(prompt: string): Promise<Record<string, unknown>> {
  return groqJson(EXTRACT_PROMPT(todayInDhaka()) + EXTRACT_RULES, prompt);
}

const isoDate = (v: unknown): string | null =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;

function int(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Apply defaults and the 30/70 budget split. Used both for Groq output and for edits the
 * traveller makes on the "Understood" chips, so the numbers are always computed the same way.
 */
export function normalizeRequest(raw: Record<string, unknown>): TripRequest {
  const today = todayInDhaka();
  const travellers = int(raw.travellers, 1, 20) ?? 2;
  let nights = int(raw.nights, 1, 30) ?? 2;

  let checkin = isoDate(raw.checkinDate) ?? addDays(today, 1);
  if (checkin < today) checkin = addDays(today, 1);

  let checkout = isoDate(raw.checkoutDate);
  if (checkout && checkout > checkin) nights = Math.min(30, daysBetween(checkin, checkout));
  checkout = addDays(checkin, nights);

  const rooms = int(raw.rooms, 1, 10) ?? Math.max(1, Math.ceil(travellers / 2));
  const total = int(raw.total_budget, 1, 10_000_000);
  const transport = total ? Math.round(total * 0.3) : null;

  const origin = text(raw.origin);
  return {
    origin,
    destination: text(raw.destination),
    checkinDate: checkin,
    checkoutDate: checkout,
    nights,
    travellers,
    rooms,
    total_budget: total,
    transport_budget: transport,
    hotel_budget: total && transport !== null ? total - transport : null,
    needs_origin: !origin,
  };
}
