import type { PlanEvent, TripRequest } from "@/lib/types";
import { extractRequest, normalizeRequest } from "@/lib/planner/request";
import { searchHotels } from "@/lib/planner/agoda";
import { buildAiPlan } from "@/lib/planner/aiPlan";
import { findTrains } from "@/lib/planner/railway";
import { geocode, getWeather } from "@/lib/planner/weather";
import { getWikiPlace } from "@/lib/planner/wikipedia";

/**
 * Plans a trip and streams progress as NDJSON (one JSON object per line), so the page can tick
 * off each step the moment it really finishes. Steps after "parse" run in parallel; any of them
 * may fail without breaking the others — the page just hides that section.
 *
 * Body: { prompt: string } for a new search, or { request: Partial<TripRequest> } to re-run
 * with values edited on the "Understood" chips (skips the Groq parsing call).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const edited = body.request && typeof body.request === "object" ? (body.request as Partial<TripRequest>) : null;

  if (!prompt && !edited) {
    return Response.json({ error: "Please describe your trip." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: PlanEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      // Run one step: tick it on success, mark it failed (and log) on error.
      // A step returns a string to mark itself skipped, with that string as the reason.
      const step = async (id: string, work: () => Promise<string | void>) => {
        try {
          const skipped = await work();
          send(typeof skipped === "string" ? { type: "step", id, status: "skipped", note: skipped } : { type: "step", id, status: "done" });
        } catch (err) {
          console.error(`[plan] step "${id}" failed:`, err);
          send({ type: "step", id, status: "failed" });
        }
      };

      try {
        send({
          type: "steps",
          steps: [
            { id: "parse", label: "Understanding your request" },
            { id: "hotels", label: "Searching hotels on Agoda" },
            { id: "trains", label: "Checking train schedules" },
            { id: "weather", label: "Getting weather" },
            { id: "plan", label: "Building your plan" },
          ],
        });

        // 1. Understand the request. Without this nothing else can run, so a failure ends the stream.
        let trip: TripRequest;
        try {
          trip = normalizeRequest(edited ? (edited as Record<string, unknown>) : await extractRequest(prompt));
        } catch (err) {
          console.error("[plan] parse failed:", err);
          send({ type: "step", id: "parse", status: "failed" });
          send({ type: "error", message: "Sorry, I couldn't understand that request. Please try rephrasing it." });
          return;
        }
        if (!trip.destination) {
          send({ type: "step", id: "parse", status: "failed" });
          send({ type: "error", message: "Where would you like to go? Please include a destination in Bangladesh." });
          return;
        }
        send({ type: "request", request: trip });
        send({ type: "step", id: "parse", status: "done" });

        const timeout = AbortSignal.timeout(25_000);
        const destination = trip.destination;

        // Wikipedia feeds both the destination header and, as a fallback, the weather coordinates.
        const wiki = getWikiPlace(destination, AbortSignal.timeout(10_000)).catch((err) => {
          console.error("[plan] Wikipedia lookup failed:", err);
          return null;
        });

        // 2. Everything else in parallel. Real trains and AI-estimated buses/flights are sent separately.
        await Promise.all([
          step("hotels", async () => {
            send({ type: "hotels", hotels: await searchHotels(trip, timeout) });
          }),
          step("trains", async () => {
            if (trip.needs_origin) return "need a starting point";
            const trains = findTrains(trip);
            if (trains === null) return `no railway station for this route`;
            send({ type: "trains", options: trains });
            if (!trains.length) return "no trains run on that day";
          }),
          step("weather", async () => {
            const coords =
              (await geocode(destination, timeout).catch(() => null)) ??
              (await wiki.then((w) => (w?.lat && w?.lon ? { lat: w.lat, lon: w.lon } : null)));
            if (!coords) throw new Error(`No coordinates for ${destination}`);
            send({ type: "weather", weather: await getWeather(trip, coords, timeout) });
          }),
          step("plan", async () => {
            const [{ transport, guides, itinerary }, info] = await Promise.all([buildAiPlan(trip, ["Bus", "Flight"]), wiki]);
            send({ type: "transport", options: transport });
            send({ type: "guides", guides });
            send({ type: "itinerary", days: itinerary });
            if (info) send({ type: "destination", info: { title: info.title, extract: info.extract, image: info.image, url: info.url } });
          }),
        ]);
      } catch (err) {
        console.error("[plan] unexpected error:", err);
        send({ type: "error", message: "Something went wrong. Please try again." });
      } finally {
        send({ type: "end" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
