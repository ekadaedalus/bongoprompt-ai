import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { cityKey, normalizeNid, normalizePhone } from "@/lib/guides";
import type { GuideStatus, LocalGuide } from "@/lib/types";

/** Verified guides for a destination. Logged-in travellers only, since profiles include a phone number. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to see guides." }, { status: 401 });

  const city = new URL(req.url).searchParams.get("city") ?? "";
  const key = cityKey(city);
  if (!key) return NextResponse.json({ guides: [] });

  // Exact match, or one name contained at the start of the other ("Sylhet" ↔ "Sylhet Sadar").
  // Pending and rejected applications never reach travellers.
  const rows = db
    .prepare(
      `SELECT id, name, phone, city, specialty, hourly_rate, experience_years, about FROM guides
       WHERE status = 'verified' AND (city_key = ? OR ? LIKE city_key || ' %' OR city_key LIKE ? || ' %')
       ORDER BY reviewed_at DESC LIMIT 20`
    )
    .all(key, key, key);

  const guides: LocalGuide[] = rows.map((r) => ({
    id: `guide-${r.id}`,
    name: String(r.name),
    specialty: String(r.specialty),
    hourly_rate: Number(r.hourly_rate),
    bio: String(r.about) || `Verified local guide based in ${String(r.city)}.`,
    phone: String(r.phone),
    kind: "registered",
    experience_years: Number(r.experience_years),
  }));
  return NextResponse.json({ guides });
}

/**
 * "Become a guide": send or update the signed-in user's guide application.
 * A new application is "pending" until an admin verifies it. A verified guide can change their city,
 * specialty, rate and description freely, but changing their name, phone or NID sends them back to review.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to register as a guide." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 80);
  const city = String(body.city ?? "").trim().slice(0, 80);
  const specialty = String(body.specialty ?? "").trim().slice(0, 80);
  const about = String(body.about ?? "").trim().slice(0, 400);
  const phone = normalizePhone(String(body.phone ?? ""));
  const rate = Math.round(Number(body.hourly_rate));
  const experience = Math.round(Number(body.experience_years));
  const nidInput = String(body.nid ?? "").trim();

  if (!name || !city || !specialty) {
    return NextResponse.json({ error: "Please fill in your name, city and specialty." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Please enter a Bangladeshi mobile number, e.g. 01712345678." }, { status: 400 });
  }
  if (!Number.isFinite(rate) || rate < 200 || rate > 10000) {
    return NextResponse.json({ error: "Hourly rate should be between ৳200 and ৳10,000." }, { status: 400 });
  }
  if (!Number.isFinite(experience) || experience < 0 || experience > 60) {
    return NextResponse.json({ error: "Years of experience should be between 0 and 60." }, { status: 400 });
  }
  if (about.length < 30) {
    return NextResponse.json({ error: "Please describe your guiding experience in at least 30 characters." }, { status: 400 });
  }

  const existing = db.prepare("SELECT name, phone, nid, status FROM guides WHERE user_id = ?").get(user.id);

  // The form shows a guide's NID masked, so leaving the field blank keeps the one on file.
  const nid = nidInput ? normalizeNid(nidInput) : String(existing?.nid ?? "") || null;
  if (!nid) {
    return NextResponse.json(
      { error: nidInput ? "Please enter a valid NID number (10, 13 or 17 digits)." : "Please enter your NID number." },
      { status: 400 }
    );
  }

  // One person, one guide profile: an NID or phone number can't back a second account.
  if (db.prepare("SELECT 1 FROM guides WHERE nid = ? AND user_id != ?").get(nid, user.id)) {
    return NextResponse.json({ error: "This NID is already registered to another guide account." }, { status: 409 });
  }
  if (db.prepare("SELECT 1 FROM guides WHERE phone = ? AND user_id != ?").get(phone, user.id)) {
    return NextResponse.json({ error: "This mobile number is already registered to another guide account." }, { status: 409 });
  }

  const identityUnchanged =
    !!existing && String(existing.name) === name && String(existing.phone) === phone && String(existing.nid) === nid;
  const status: GuideStatus = existing?.status === "verified" && identityUnchanged ? "verified" : "pending";

  if (status === "verified") {
    db.prepare(
      "UPDATE guides SET city = ?, city_key = ?, specialty = ?, hourly_rate = ?, experience_years = ?, about = ? WHERE user_id = ?"
    ).run(city, cityKey(city), specialty, rate, experience, about, user.id);
  } else {
    db.prepare(
      `INSERT INTO guides (user_id, name, phone, city, city_key, specialty, hourly_rate, nid, experience_years, about, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, phone = excluded.phone, city = excluded.city,
         city_key = excluded.city_key, specialty = excluded.specialty, hourly_rate = excluded.hourly_rate,
         nid = excluded.nid, experience_years = excluded.experience_years, about = excluded.about,
         status = 'pending', review_note = '', submitted_at = excluded.submitted_at, reviewed_at = NULL`
    ).run(user.id, name, phone, city, cityKey(city), specialty, rate, nid, experience, about);
  }

  return NextResponse.json({ ok: true, status });
}
