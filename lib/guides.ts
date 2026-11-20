import type { GuideStatus } from "./types";

/** "Cox's Bazar" → "coxs bazar", "Sajek Valley" → "sajek". Used to match guides to destinations. */
export function cityKey(city: string): string {
  return city
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\b(city|town|sadar|district|division|valley|upazila)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** 01712345678, +8801712345678 and 8801712345678 all become 01712345678, so one number can't be listed twice. */
export function normalizePhone(raw: string): string | null {
  const m = raw.replace(/[\s-]/g, "").match(/^(?:\+?880|0)(1[3-9]\d{8})$/);
  return m ? `0${m[1]}` : null;
}

/**
 * Bangladeshi NID: 10 digits (smart card), 13 digits (old card) or 17 digits (old card with birth year first).
 * This only checks the shape. Whether the NID is real and belongs to the applicant is the reviewer's call.
 */
export function normalizeNid(raw: string): string | null {
  const nid = raw.replace(/[\s-]/g, "");
  if (!/^(\d{10}|\d{13}|\d{17})$/.test(nid)) return null;
  if (nid.length === 17) {
    const birthYear = Number(nid.slice(0, 4));
    const thisYear = new Date().getFullYear();
    if (birthYear < 1900 || birthYear > thisYear - 18) return null;
  }
  return nid;
}

/** "1234567890" → "•••••• 7890", for showing a guide their own NID on file. */
export function maskNid(nid: string): string {
  return nid ? `•••••• ${nid.slice(-4)}` : "";
}

export function isGuideStatus(v: unknown): v is GuideStatus {
  return v === "pending" || v === "verified" || v === "rejected";
}
