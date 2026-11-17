import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isTripStatus, rowToTrip } from "@/lib/trips";

type Ctx = { params: Promise<{ id: string }> };

// Trips that don't exist and trips owned by someone else both get a 404, so IDs can't be probed.
const notFound = () => NextResponse.json({ error: "Trip not found." }, { status: 404 });

/** Change a trip's status: { status: "upcoming" | "booked" | "completed" | "cancelled" }. */
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return notFound();
  const { id } = await params;

  const { status } = await req.json().catch(() => ({}));
  if (!isTripStatus(status)) {
    return NextResponse.json({ error: "Status must be upcoming, booked, completed or cancelled." }, { status: 400 });
  }

  const { changes } = db.prepare("UPDATE trips SET status = ? WHERE id = ? AND user_id = ?").run(status, id, user.id);
  if (!changes) return notFound();

  const row = db.prepare("SELECT data, status, checkout FROM trips WHERE id = ?").get(id);
  return NextResponse.json({ trip: row ? rowToTrip(row) : null });
}

/** Delete a trip permanently. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return notFound();
  const { id } = await params;

  const { changes } = db.prepare("DELETE FROM trips WHERE id = ? AND user_id = ?").run(id, user.id);
  if (!changes) return notFound();
  return NextResponse.json({ ok: true });
}
