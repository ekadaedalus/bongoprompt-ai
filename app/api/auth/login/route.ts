import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  const pass = String(password ?? "");

  const row = db.prepare("SELECT id, name, email, password_hash FROM users WHERE email = ?").get(cleanEmail);
  if (!row || !verifyPassword(pass, String(row.password_hash))) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const id = Number(row.id);
  await startSession(id);
  return NextResponse.json({ user: { id, name: String(row.name), email: String(row.email) } });
}
