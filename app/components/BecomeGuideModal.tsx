"use client";
import { useEffect, useState } from "react";
import type { GuideApplication, GuideStatus } from "@/lib/types";

interface Props {
  defaultName: string;
  defaultCity: string;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  "w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all";

const STATUS_BANNER: Record<GuideStatus, { title: string; body: string; className: string }> = {
  pending: {
    title: "⏳ Waiting for review",
    body: "We're checking your details. Travellers will see your profile once you're verified.",
    className: "text-amber-800 bg-amber-50 border-amber-200",
  },
  verified: {
    title: "✅ You're a verified guide",
    body: "Travellers heading to your city can see and request you. Changing your name, mobile number or NID sends your profile back for review.",
    className: "text-green-800 bg-green-50 border-green-200",
  },
  rejected: {
    title: "✖ Application not approved",
    body: "Fix the problem below and send it again.",
    className: "text-red-800 bg-red-50 border-red-200",
  },
};

/**
 * "Become a guide" application. A profile is reviewed by an admin before travellers see it,
 * so this form also shows where the signed-in guide's application stands.
 */
export default function BecomeGuideModal({ defaultName, defaultCity, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: defaultName, phone: "", nid: "", city: defaultCity, specialty: "", experience_years: "1", about: "", hourly_rate: "800",
  });
  const [application, setApplication] = useState<GuideApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState<GuideStatus | null>(null);

  // Returning guides get their application back, with its review status.
  useEffect(() => {
    fetch("/api/guides/me")
      .then((r) => (r.ok ? r.json() : { application: null }))
      .then((d: { application: GuideApplication | null }) => {
        const a = d.application;
        if (!a) return;
        setApplication(a);
        setForm({
          name: a.name, phone: a.phone, nid: "", city: a.city, specialty: a.specialty,
          experience_years: String(a.experience_years), about: a.about, hourly_rate: String(a.hourly_rate),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, hourly_rate: Number(form.hourly_rate), experience_years: Number(form.experience_years) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSavedStatus(data.status === "verified" ? "verified" : "pending");
      onSaved();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const banner = application ? STATUS_BANNER[application.status] : null;
  const nidOnFile = application?.nid_masked ?? "";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 pt-8 pb-2 text-center">
          <div className="text-5xl mb-3">🧭</div>
          <h2 id="guide-title" className="text-2xl font-bold text-slate-800">{application ? "Your guide profile" : "Become a guide"}</h2>
          <p className="text-slate-500 text-sm mt-1">Show travellers your city. Every guide is verified before travellers can see them.</p>
        </div>

        {loading ? (
          <p className="px-8 py-10 text-center text-slate-500 text-sm">Loading…</p>
        ) : savedStatus ? (
          <div className="px-8 py-6 text-center space-y-4">
            {savedStatus === "verified" ? (
              <p className="text-green-700 bg-green-50 border-2 border-green-200 rounded-xl px-4 py-3 font-semibold">
                ✅ Profile updated. You&apos;re still listed as a verified guide in {form.city}.
              </p>
            ) : (
              <p className="text-amber-800 bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3 font-semibold">
                ⏳ Application sent. We&apos;ll review your details, and travellers will see your profile once you&apos;re verified. Open this form again to check your status.
              </p>
            )}
            <button onClick={onClose}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-8 py-6 space-y-4">
            {banner && application && (
              <div className={`rounded-xl border-2 px-4 py-3 text-sm ${banner.className}`} role="status">
                <p className="font-bold">{banner.title}</p>
                <p className="mt-0.5">{banner.body}</p>
                {application.status === "rejected" && application.review_note && (
                  <p className="mt-2 font-semibold">Reason: {application.review_note}</p>
                )}
                {application.status === "pending" && !nidOnFile && (
                  <p className="mt-2 font-semibold">Add your NID number below so we can review you.</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="g-name" className="block text-sm font-semibold text-slate-700 mb-1">Full name, as on your NID</label>
              <input id="g-name" required maxLength={80} value={form.name} onChange={set("name")} className={inputClass} />
            </div>
            <div>
              <label htmlFor="g-phone" className="block text-sm font-semibold text-slate-700 mb-1">Mobile number</label>
              <input id="g-phone" type="tel" required value={form.phone} onChange={set("phone")} placeholder="01712345678" className={inputClass} />
              <p className="text-xs text-slate-500 mt-1">Shown to travellers who request you, so they can contact you.</p>
            </div>
            <div>
              <label htmlFor="g-nid" className="block text-sm font-semibold text-slate-700 mb-1">NID number</label>
              <input
                id="g-nid"
                inputMode="numeric"
                required={!nidOnFile}
                value={form.nid}
                onChange={set("nid")}
                placeholder={nidOnFile ? `${nidOnFile} on file. Leave blank to keep it` : "10, 13 or 17 digits"}
                className={inputClass}
              />
              <p className="text-xs text-slate-500 mt-1">Used only to verify who you are. Never shown to travellers.</p>
            </div>
            <div>
              <label htmlFor="g-city" className="block text-sm font-semibold text-slate-700 mb-1">City</label>
              <input id="g-city" required maxLength={80} value={form.city} onChange={set("city")} placeholder="e.g. Sylhet" className={inputClass} />
            </div>
            <div>
              <label htmlFor="g-spec" className="block text-sm font-semibold text-slate-700 mb-1">Specialty</label>
              <input id="g-spec" required maxLength={80} value={form.specialty} onChange={set("specialty")} placeholder="e.g. Tea gardens & hiking" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="g-exp" className="block text-sm font-semibold text-slate-700 mb-1">Years guiding</label>
                <input id="g-exp" type="number" required min={0} max={60} value={form.experience_years} onChange={set("experience_years")} className={inputClass} />
              </div>
              <div>
                <label htmlFor="g-rate" className="block text-sm font-semibold text-slate-700 mb-1">Hourly rate (৳)</label>
                <input id="g-rate" type="number" required min={200} max={10000} step={50} value={form.hourly_rate} onChange={set("hourly_rate")} className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="g-about" className="block text-sm font-semibold text-slate-700 mb-1">About your guiding</label>
              <textarea
                id="g-about"
                required
                minLength={30}
                maxLength={400}
                rows={3}
                value={form.about}
                onChange={set("about")}
                placeholder="Where you take travellers, languages you speak, what makes your tours special."
                className={inputClass}
              />
              <p className="text-xs text-slate-500 mt-1">Shown on your profile. At least 30 characters.</p>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={saving}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50">
              {saving ? "Saving…" : application?.status === "verified" ? "Save changes" : application ? "Send again for review" : "Apply for verification"}
            </button>
            <button type="button" onClick={onClose} className="w-full text-sm text-slate-500 hover:text-slate-700 font-semibold">
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
