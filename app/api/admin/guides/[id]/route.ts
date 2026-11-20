import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });

/**
 * Review a guide application: { status: "verified" } or { status: "rejected", note: "why" }.
 * Rejecting a verified guide takes them off the traveller listing. Admins only.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return notFound();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return notFound();

  const body = await req.json().catch(() => ({}));
  const status = body.status;
  const note = String(body.note ?? "").trim().slice(0, 300);
  if (status !== "verified" && status !== "rejected") {
    return NextResponse.json({ error: "Status must be verified or rejected." }, { status: 400 });
  }
  if (status === "rejected" && note.length < 5) {
    return NextResponse.json({ error: "Please give the guide a short reason for the rejection." }, { status: 400 });
  }

  const guide = db.prepare("SELECT nid FROM guides WHERE id = ?").get(id);
  if (!guide) return notFound();
  if (status === "verified" && !String(guide.nid)) {
    return NextResponse.json({ error: "This guide has no NID on file, so they can't be verified yet." }, { status: 400 });
  }

  db.prepare("UPDATE guides SET status = ?, review_note = ?, reviewed_at = datetime('now') WHERE id = ?").run(
    status,
    status === "rejected" ? note : "",
    id
  );
  return NextResponse.json({ ok: true, status });
}
