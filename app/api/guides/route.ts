import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { LocalGuide } from "@/lib/types";

/** "Cox's Bazar" → "coxs bazar", "Sajek Valley" → "sajek". Used to match guides to destinations. */
function cityKey(city: string): string {
  return city
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\b(city|town|sadar|district|division|valley|upazila)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Registered guides for a destination. Logged-in travellers only, since profiles include a phone number. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to see guides." }, { status: 401 });

  const city = new URL(req.url).searchParams.get("city") ?? "";
  const key = cityKey(city);
  if (!key) return NextResponse.json({ guides: [] });

  // Exact match, or one name contained at the start of the other ("Sylhet" ↔ "Sylhet Sadar").
  const rows = db
    .prepare(
      `SELECT id, name, phone, city, specialty, hourly_rate FROM guides
       WHERE city_key = ? OR ? LIKE city_key || ' %' OR city_key LIKE ? || ' %'
       ORDER BY created_at DESC LIMIT 20`
    )
    .all(key, key, key);

  const guides: LocalGuide[] = rows.map((r) => ({
    id: `guide-${r.id}`,
    name: String(r.name),
    specialty: String(r.specialty),
    hourly_rate: Number(r.hourly_rate),
    bio: `Registered local guide based in ${String(r.city)}.`,
    phone: String(r.phone),
    kind: "registered",
  }));
  return NextResponse.json({ guides });
}

/** "Become a guide": create or update the signed-in user's guide profile. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to register as a guide." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 80);
  const city = String(body.city ?? "").trim().slice(0, 80);
  const specialty = String(body.specialty ?? "").trim().slice(0, 80);
  const phone = String(body.phone ?? "").replace(/[\s-]/g, "");
  const rate = Math.round(Number(body.hourly_rate));

  if (!name || !city || !specialty) {
    return NextResponse.json({ error: "Please fill in your name, city and specialty." }, { status: 400 });
  }
  if (!/^(\+?880|0)1[3-9]\d{8}$/.test(phone)) {
    return NextResponse.json({ error: "Please enter a Bangladeshi mobile number, e.g. 01712345678." }, { status: 400 });
  }
  if (!Number.isFinite(rate) || rate < 200 || rate > 10000) {
    return NextResponse.json({ error: "Hourly rate should be between ৳200 and ৳10,000." }, { status: 400 });
  }

  db.prepare(
    `INSERT INTO guides (user_id, name, phone, city, city_key, specialty, hourly_rate) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, phone = excluded.phone, city = excluded.city,
       city_key = excluded.city_key, specialty = excluded.specialty, hourly_rate = excluded.hourly_rate`
  ).run(user.id, name, phone, city, cityKey(city), specialty, rate);

  return NextResponse.json({ ok: true });
}
