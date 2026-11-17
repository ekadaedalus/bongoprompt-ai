import type { TrainFare, TransportOption, TripRequest } from "../types";
import railway from "../../data/railway/railway.json";

/**
 * Real Bangladesh Railway timetables and fares from a local snapshot of the MIT-licensed dataset
 * (data/railway/, see LICENSE there). No network call, so this step never fails on a flaky API.
 */

interface RawTrain {
  name: string;
  number: string;
  days: string[];
  duration: string;
  stops: [string, string | null, string | null][]; // [station, arrival, departure]
}

const TRAINS = railway.trains as unknown as RawTrain[];
const FARES = railway.fares as unknown as Record<string, [string, number][]>;

const CLASS_LABELS: Record<string, string> = {
  S_CHAIR: "Shovan Chair",
  SHOVAN: "Shovan",
  SHULOV: "Shulov",
  F_SEAT: "First Seat",
  F_CHAIR: "First Chair",
  F_BERTH: "First Berth",
  SNIGDHA: "Snigdha",
  AC_S: "AC Seat",
  AC_B: "AC Berth",
  AC_CHAIR: "AC Chair",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS: Record<string, string> = {
  Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday",
};

const key = (s: string) =>
  s.toLowerCase().replace(/['’]/g, "").replace(/[_\s]+/g, " ").replace(/\b(city|sadar|district|town)\b/g, "").trim();

/** Tourist names → the station travellers actually use. */
const ALIASES: Record<string, string> = {
  chittagong: "chattogram",
  ctg: "chattogram",
  "cox bazar": "coxs bazar",
  "coxsbazar": "coxs bazar",
  srimangal: "sreemangal",
  sreemongol: "sreemangal",
  "sylhet tea gardens": "sylhet",
  sundarbans: "khulna",
  sundarban: "khulna",
  mongla: "khulna",
  jessore: "jashore",
  comilla: "cumilla",
  bogra: "bogura",
  kamalapur: "dhaka",
  "dhaka airport": "biman bandar",
  airport: "biman bandar",
};

const STATION_KEYS = new Map<string, string>(); // normalized → display name
for (const t of TRAINS) for (const [name] of t.stops) STATION_KEYS.set(key(name), name);

/** Find the station for a place name, or null when the place has no railway station. */
export function findStation(place: string | null): string | null {
  if (!place) return null;
  let k = key(place);
  k = ALIASES[k] ?? k;
  if (STATION_KEYS.has(k)) return STATION_KEYS.get(k)!;
  // "Sylhet Division", "Khulna (Sundarbans)" … try the first word too.
  const first = k.split(" ")[0];
  const aliased = ALIASES[first] ?? first;
  return STATION_KEYS.get(aliased) ?? null;
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bCoxs\b/g, "Cox's");

const prettyTime = (t: string | null) => (t ? t.replace(/^0(\d)/, "$1") : "—");

function minutes(t: string | null): number | null {
  const m = t?.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === "pm") h += 12;
  return h * 60 + Number(m[2]);
}

function duration(dep: string | null, arr: string | null): string {
  const a = minutes(dep);
  const b = minutes(arr);
  if (a === null || b === null) return "";
  const total = (b - a + 1440) % 1440;
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

function faresFor(from: string, to: string): TrainFare[] {
  const list = FARES[`${key(from)}|${key(to)}`] ?? FARES[`${key(to)}|${key(from)}`] ?? [];
  return list
    .map(([cls, fare]) => ({ cls, label: CLASS_LABELS[cls] ?? cls, fare }))
    .filter((f) => f.fare > 0)
    .sort((a, b) => a.fare - b.fare);
}

/** e.g. 20-Nov-2026, the date format eticket.railway.gov.bd uses in its search URL. */
function railDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${String(d.getUTCDate()).padStart(2, "0")}-${month}-${d.getUTCFullYear()}`;
}

export function bookingLink(from: string, to: string, iso: string, cls?: string): string {
  const params = new URLSearchParams({ fromcity: from, tocity: to, doj: railDate(iso) });
  if (cls) params.set("class", cls);
  return `https://eticket.railway.gov.bd/booking/train/search?${params}`;
}

/**
 * Trains that call at the origin and later at the destination and run on the travel date.
 * Returns null when either end has no station (the page then shows no train section).
 */
export function findTrains(req: TripRequest): TransportOption[] | null {
  const from = findStation(req.origin);
  const to = findStation(req.destination);
  if (!from || !to || from === to) return null;

  const weekday = WEEKDAYS[new Date(`${req.checkinDate}T00:00:00Z`).getUTCDay()];
  const fares = faresFor(from, to);

  const found: TransportOption[] = [];
  for (const t of TRAINS) {
    const i = t.stops.findIndex(([s]) => s === from);
    const j = t.stops.findIndex(([s], idx) => idx > i && s === to);
    if (i < 0 || j < 0) continue;
    if (!t.days.includes(weekday)) continue;

    const dep = t.stops[i][2];
    const arr = t.stops[j][1];
    const off = WEEKDAYS.filter((d) => !t.days.includes(d)).map((d) => FULL_DAYS[d]);

    found.push({
      id: `rail-${t.number}`,
      type: "Train",
      provider: `${titleCase(t.name)} (${t.number})`,
      train_number: t.number,
      departure_time: prettyTime(dep),
      arrival_time: prettyTime(arr),
      duration: duration(dep, arr),
      price: fares[0]?.fare ?? 0,
      fare_class: fares[0]?.cls,
      fares,
      off_days: off.length ? `Off day: ${off.join(", ")}` : "Runs every day",
      departure_station: `${titleCase(from)} Railway Station`,
      arrival_station: `${titleCase(to)} Railway Station`,
      source: "railway",
      booking_url: bookingLink(from, to, req.checkinDate, fares[0]?.cls),
    });
  }

  return found.sort((a, b) => (minutes(a.departure_time) ?? 9999) - (minutes(b.departure_time) ?? 9999));
}
