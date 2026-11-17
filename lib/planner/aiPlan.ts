import type { ItineraryDay, LocalGuide, TransportOption, TripRequest } from "../types";
import { groqJson } from "./groq";

/* eslint-disable @typescript-eslint/no-explicit-any -- model output is validated field by field below */

const BUILD_PROMPT = (modes: string[]) => `You are a travel planner for trips WITHIN BANGLADESH. Prices are in BDT (৳).
You receive a trip as JSON. Write every text value in English (names in Latin letters).
Return ONLY a JSON object with these keys:

"transport_options": 2-5 typical ${modes.join(" / ")} options from origin to destination, as realistic ESTIMATES.
  Only include Flight if a scheduled domestic flight exists between the nearest airports.
  Each: type (${modes.map((m) => `"${m}"`).join(" | ")}), provider, departure_time, arrival_time, duration,
  price (per person, BDT), departure_station (real name, e.g. Gabtoli, Sayedabad, Hazrat Shahjalal Airport),
  arrival_station. Flight providers must be one of: Biman Bangladesh Airlines, US-Bangla Airlines, NOVOAIR, Air Astra.
  If origin is null, return an empty list.

"local_guides": 3 SAMPLE guide profiles for the destination (placeholders, not real people).
  Each: name (Bengali name), specialty (e.g. "Historical Sites", "Food & Culture", "Nature & Wildlife"),
  hourly_rate (500-1500), rating (4.0-5.0), bio (one short sentence).

"itinerary": exactly one entry per day of the trip (nights + 1 days).
  Each: day (1, 2, …), morning, afternoon, evening, food — each a short phrase (max 12 words) naming real
  places in or near the destination. Day 1 starts with arriving; the last day ends with heading home.
  food = a local dish or food experience worth trying that day.`;

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v.trim() : fallback);
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

const AIRLINE_SITES: Record<string, string> = {
  biman: "https://www.biman-airlines.com",
  "us-bangla": "https://usbair.com",
  "us bangla": "https://usbair.com",
  novo: "https://www.flynovoair.com",
  astra: "https://airastra.com",
};

function bookingUrl(type: string, provider: string): string {
  if (type === "Bus") return "https://www.shohoz.com/bus-tickets";
  if (type === "Train") return "https://eticket.railway.gov.bd";
  const key = Object.keys(AIRLINE_SITES).find((k) => provider.toLowerCase().includes(k));
  return key ? AIRLINE_SITES[key] : "https://www.google.com/travel/flights";
}

/** AI-estimated rides and sample guides. Everything here is tagged "AI estimate" / "Sample" in the UI. */
export async function buildAiPlan(req: TripRequest, modes: ("Bus" | "Train" | "Flight")[]) {
  const out = await groqJson<any>(
    BUILD_PROMPT(modes),
    JSON.stringify({
      origin: req.origin,
      destination: req.destination,
      checkinDate: req.checkinDate,
      nights: req.nights,
      travellers: req.travellers,
      transport_budget_per_person: req.transport_budget ? Math.round(req.transport_budget / req.travellers) : null,
    })
  );

  const transport: TransportOption[] = (Array.isArray(out.transport_options) ? out.transport_options : [])
    .filter((o: any) => modes.includes(o?.type) && num(o?.price) > 0)
    .map((o: any, i: number): TransportOption => ({
      id: `ai-${i}`,
      type: o.type,
      provider: str(o.provider, o.type),
      departure_time: str(o.departure_time),
      arrival_time: str(o.arrival_time),
      duration: str(o.duration),
      price: num(o.price),
      departure_station: str(o.departure_station, req.origin ?? ""),
      arrival_station: str(o.arrival_station, req.destination ?? ""),
      source: "ai",
      booking_url: bookingUrl(o.type, str(o.provider)),
    }));

  const guides: LocalGuide[] = (Array.isArray(out.local_guides) ? out.local_guides : [])
    .filter((g: any) => str(g?.name))
    .slice(0, 4)
    .map((g: any, i: number): LocalGuide => ({
      id: `sample-${i}`,
      name: str(g.name),
      specialty: str(g.specialty, "Local Expert"),
      hourly_rate: Math.min(1500, Math.max(500, num(g.hourly_rate) || 800)),
      rating: Math.min(5, Math.max(4, Number(g.rating) || 4.5)),
      bio: str(g.bio),
      kind: "sample",
    }));

  const itinerary: ItineraryDay[] = (Array.isArray(out.itinerary) ? out.itinerary : [])
    .slice(0, req.nights + 1)
    .map((d: any, i: number): ItineraryDay => ({
      day: i + 1,
      morning: str(d?.morning),
      afternoon: str(d?.afternoon),
      evening: str(d?.evening),
      food: str(d?.food),
    }))
    .filter((d: ItineraryDay) => d.morning || d.afternoon || d.evening);

  return { transport, guides, itinerary };
}
