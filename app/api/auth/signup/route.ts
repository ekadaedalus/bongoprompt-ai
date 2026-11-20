import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, startSession, toPublicUser } from "@/lib/auth";

export async function POST(req: Request) {
  const { name, email, password } = await req.json().catch(() => ({}));
  const cleanName = String(name ?? "").trim();
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  const pass = String(password ?? "");

  if (!cleanName || !cleanEmail || !pass) {
    return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (pass.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail)) {
    return NextResponse.json({ error: "An account with this email already exists. Please log in." }, { status: 409 });
  }

  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run(cleanName, cleanEmail, hashPassword(pass));

  const id = Number(lastInsertRowid);
  await startSession(id);
  return NextResponse.json({ user: toPublicUser(id, cleanName, cleanEmail) });
}
