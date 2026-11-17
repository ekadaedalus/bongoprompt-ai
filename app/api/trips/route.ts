import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { TripRecord } from "@/lib/types";
import { rowToTrip } from "@/lib/trips";

// No 0/O or 1/I, so IDs are easy to read out loud and type.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newTripId = () => "BT-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/** The signed-in traveller's saved trips, newest first. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to see your trips." }, { status: 401 });

  const rows = db
    .prepare("SELECT data, status, checkout FROM trips WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 100")
    .all(user.id);
  return NextResponse.json({ trips: rows.map(rowToTrip) });
}

/** Save a confirmed plan. The trip ID is generated here, once, and stored with it. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to save your trip." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Omit<TripRecord, "id" | "createdAt" | "status"> | null;
  if (!body?.request?.destination || !body.transport?.provider || !body.hotel?.name || !body.costs) {
    return NextResponse.json({ error: "That trip is missing its ride or hotel." }, { status: 400 });
  }

  const total = Math.round(Number(body.costs.total) || 0);
  const insert = db.prepare(
    "INSERT INTO trips (id, user_id, origin, destination, checkin, checkout, total, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  // Retry on the (very unlikely) chance of an ID collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const trip: TripRecord = {
      id: newTripId(),
      createdAt: new Date().toISOString(),
      status: "upcoming",
      request: body.request,
      transport: body.transport,
      hotel: body.hotel,
      guide: body.guide ?? null,
      guideHours: Math.round(Number(body.guideHours) || 0),
      costs: body.costs,
      itinerary: Array.isArray(body.itinerary) ? body.itinerary : [],
    };
    try {
      insert.run(trip.id, user.id, trip.request.origin, trip.request.destination, trip.request.checkinDate, trip.request.checkoutDate, total, JSON.stringify(trip));
      return NextResponse.json({ trip });
    } catch (err) {
      if (!String(err).includes("UNIQUE")) throw err;
    }
  }
  return NextResponse.json({ error: "Could not save your trip. Please try again." }, { status: 500 });
}
