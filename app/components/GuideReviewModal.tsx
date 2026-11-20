"use client";
import { useEffect, useState } from "react";
import type { GuideReview, GuideStatus } from "@/lib/types";
import { plural, taka } from "@/lib/format";

const STATUS_CHIP: Record<GuideStatus, { label: string; className: string }> = {
  pending: { label: "⏳ Pending", className: "bg-amber-100 text-amber-800 border-amber-200" },
  verified: { label: "✓ Verified", className: "bg-green-100 text-green-700 border-green-200" },
  rejected: { label: "✖ Rejected", className: "bg-red-100 text-red-700 border-red-200" },
};

/** Admin panel: check each guide application against their NID and phone, then verify or reject it. */
export default function GuideReviewModal({ onClose, onReviewed }: { onClose: () => void; onReviewed: () => void }) {
  const [applications, setApplications] = useState<GuideReview[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  // The application whose rejection reason is being written.
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/admin/guides")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load applications.");
        setApplications(d.applications);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const review = async (app: GuideReview, status: "verified" | "rejected") => {
    setBusyId(app.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/guides/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not save the review.");
      setApplications((prev) => prev?.map((a) => (a.id === app.id ? { ...a, status, review_note: status === "rejected" ? note.trim() : "" } : a)) ?? null);
      setRejectingId(null);
      setNote("");
      onReviewed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const pending = applications?.filter((a) => a.status === "pending").length ?? 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 pt-8 pb-4 flex items-start justify-between">
          <div>
            <h2 id="review-title" className="text-2xl font-bold text-slate-800">🛡️ Guide applications</h2>
            <p className="text-slate-500 text-sm mt-1">
              {applications ? `${plural(pending, "application")} waiting for review.` : "Check each guide before travellers can see them."}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="px-8 pb-8 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {!applications && !error && <p className="text-slate-500 text-sm">Loading…</p>}
          {applications?.length === 0 && (
            <p className="text-slate-500 text-sm bg-slate-50 rounded-xl border-2 border-slate-200 p-4 text-center">No guide applications yet.</p>
          )}
          {applications?.map((a) => {
            const chip = STATUS_CHIP[a.status];
            const busy = busyId === a.id;
            return (
              <div key={a.id} className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-base text-slate-800">{a.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${chip.className}`}>{chip.label}</span>
                </div>
                <p className="text-purple-600 font-semibold">
                  {a.specialty} · {a.city} · {taka(a.hourly_rate)}/h · {plural(a.experience_years, "year")}
                </p>
                {a.about && <p className="mt-2 italic">&ldquo;{a.about}&rdquo;</p>}
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="font-semibold text-slate-500">NID</dt>
                  <dd className="font-mono break-all">{a.nid || <span className="font-sans text-red-600 font-semibold">Not provided yet</span>}</dd>
                  <dt className="font-semibold text-slate-500">Phone</dt>
                  <dd><a className="font-bold text-blue-700" href={`tel:${a.phone}`}>{a.phone}</a></dd>
                  <dt className="font-semibold text-slate-500">Account</dt>
                  <dd className="break-all">{a.account_name} · {a.email}</dd>
                  {a.submitted_at && (
                    <>
                      <dt className="font-semibold text-slate-500">Sent</dt>
                      <dd>{a.submitted_at} UTC</dd>
                    </>
                  )}
                </dl>
                {a.status === "rejected" && a.review_note && <p className="mt-2 text-red-700 font-semibold">Reason given: {a.review_note}</p>}

                {rejectingId === a.id ? (
                  <div className="mt-3 space-y-2">
                    <label htmlFor={`note-${a.id}`} className="block font-semibold text-slate-700">Reason, shown to the guide</label>
                    <textarea
                      id={`note-${a.id}`}
                      rows={2}
                      maxLength={300}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. The name doesn't match the NID."
                      className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => review(a, "rejected")} disabled={busy || note.trim().length < 5}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all disabled:opacity-50">
                        {busy ? "Saving…" : "Reject application"}
                      </button>
                      <button onClick={() => { setRejectingId(null); setNote(""); }} disabled={busy}
                        className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-all">
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.status !== "verified" && (
                      <button onClick={() => review(a, "verified")} disabled={busy || !a.nid}
                        title={a.nid ? undefined : "This guide hasn't provided an NID yet"}
                        className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-all disabled:opacity-50">
                        {busy ? "Saving…" : "✓ Verify"}
                      </button>
                    )}
                    {a.status !== "rejected" && (
                      <button onClick={() => { setRejectingId(a.id); setNote(""); }} disabled={busy}
                        className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-all disabled:opacity-50">
                        {a.status === "verified" ? "Remove verification" : "Reject"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
