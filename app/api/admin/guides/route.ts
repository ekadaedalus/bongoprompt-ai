import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isGuideStatus } from "@/lib/guides";
import type { GuideReview } from "@/lib/types";

/** Every guide application, waiting ones first. Admins only; everyone else gets a 404 so the route can't be probed. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const rows = db
    .prepare(
      `SELECT g.id, g.name, g.phone, g.city, g.specialty, g.hourly_rate, g.experience_years, g.about, g.nid,
              g.status, g.review_note, g.submitted_at, u.email, u.name AS account_name
       FROM guides g JOIN users u ON u.id = g.user_id
       ORDER BY CASE g.status WHEN 'pending' THEN 0 WHEN 'verified' THEN 1 ELSE 2 END, g.submitted_at DESC
       LIMIT 200`
    )
    .all();

  const applications: GuideReview[] = rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    phone: String(r.phone),
    city: String(r.city),
    specialty: String(r.specialty),
    hourly_rate: Number(r.hourly_rate),
    experience_years: Number(r.experience_years),
    about: String(r.about),
    nid: String(r.nid),
    status: isGuideStatus(r.status) ? r.status : "pending",
    review_note: String(r.review_note),
    submitted_at: String(r.submitted_at),
    email: String(r.email),
    account_name: String(r.account_name),
  }));
  return NextResponse.json({ applications });
}
