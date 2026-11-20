import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isGuideStatus, maskNid } from "@/lib/guides";
import type { GuideApplication } from "@/lib/types";

/** The signed-in user's own guide application and its review status, or null if they haven't applied. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const r = db
    .prepare(
      `SELECT name, phone, city, specialty, hourly_rate, experience_years, about, nid, status, review_note
       FROM guides WHERE user_id = ?`
    )
    .get(user.id);
  if (!r) return NextResponse.json({ application: null });

  const application: GuideApplication = {
    name: String(r.name),
    phone: String(r.phone),
    city: String(r.city),
    specialty: String(r.specialty),
    hourly_rate: Number(r.hourly_rate),
    experience_years: Number(r.experience_years),
    about: String(r.about),
    nid_masked: maskNid(String(r.nid)),
    status: isGuideStatus(r.status) ? r.status : "pending",
    review_note: String(r.review_note),
  };
  return NextResponse.json({ application });
}
