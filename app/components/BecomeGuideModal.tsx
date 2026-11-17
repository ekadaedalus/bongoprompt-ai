"use client";
import { useState } from "react";

interface Props {
  defaultName: string;
  defaultCity: string;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  "w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all";

/** "Become a guide" sign-up form. Saved to the guides table under the signed-in account. */
export default function BecomeGuideModal({ defaultName, defaultCity, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ name: defaultName, phone: "", city: defaultCity, specialty: "", hourly_rate: "800" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, hourly_rate: Number(form.hourly_rate) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
      onSaved();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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
          <h2 id="guide-title" className="text-2xl font-bold text-slate-800">Become a guide</h2>
          <p className="text-slate-500 text-sm mt-1">Show travellers your city. Your profile appears to travellers heading there.</p>
        </div>

        {done ? (
          <div className="px-8 py-6 text-center space-y-4">
            <p className="text-green-700 bg-green-50 border-2 border-green-200 rounded-xl px-4 py-3 font-semibold">
              ✅ You&apos;re listed as a guide in {form.city}!
            </p>
            <button onClick={onClose}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-8 py-6 space-y-4">
            <div>
              <label htmlFor="g-name" className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
              <input id="g-name" required value={form.name} onChange={set("name")} className={inputClass} />
            </div>
            <div>
              <label htmlFor="g-phone" className="block text-sm font-semibold text-slate-700 mb-1">Mobile number</label>
              <input id="g-phone" type="tel" required value={form.phone} onChange={set("phone")} placeholder="01712345678" className={inputClass} />
              <p className="text-xs text-slate-500 mt-1">Shown to travellers who request you, so they can contact you.</p>
            </div>
            <div>
              <label htmlFor="g-city" className="block text-sm font-semibold text-slate-700 mb-1">City</label>
              <input id="g-city" required value={form.city} onChange={set("city")} placeholder="e.g. Sylhet" className={inputClass} />
            </div>
            <div>
              <label htmlFor="g-spec" className="block text-sm font-semibold text-slate-700 mb-1">Specialty</label>
              <input id="g-spec" required value={form.specialty} onChange={set("specialty")} placeholder="e.g. Tea gardens & hiking" className={inputClass} />
            </div>
            <div>
              <label htmlFor="g-rate" className="block text-sm font-semibold text-slate-700 mb-1">Hourly rate (৳)</label>
              <input id="g-rate" type="number" required min={200} max={10000} step={50} value={form.hourly_rate} onChange={set("hourly_rate")} className={inputClass} />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={saving}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50">
              {saving ? "Saving…" : "List me as a guide"}
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
