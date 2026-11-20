"use client";
import { useState } from "react";

export interface User {
  id: number;
  name: string;
  email: string;
  isAdmin?: boolean;
}

interface Props {
  onAuthenticated: (user: User) => void;
  onCancel: () => void;
  /** Heading on the log-in tab, e.g. "Log in to save your plan". */
  title?: string;
  subtitle?: string;
  cancelLabel?: string;
}

export default function AuthModal({
  onAuthenticated,
  onCancel,
  title = "Log in to BongoPrompt",
  subtitle = "Log in to save trips and register as a guide.",
  cancelLabel = "Close",
}: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { name, email, password } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
      >
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="text-5xl mb-3">🔐</div>
          <h2 id="auth-title" className="text-2xl font-bold text-slate-800">
            {mode === "login" ? title : "Create your account"}
          </h2>
          <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
        </div>

        {/* Tabs */}
        <div className="mx-8 grid grid-cols-2 bg-slate-100 rounded-xl p-1 text-sm font-bold">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`py-2 rounded-lg transition-all ${
                mode === m ? "bg-white text-purple-700 shadow" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {m === "login" ? "Log in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="px-8 py-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label htmlFor="auth-name" className="block text-sm font-semibold text-slate-700 mb-1">Full name</label>
              <input id="auth-name" type="text" autoComplete="name" required value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputClass} />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
            <input id="auth-email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <input id="auth-password" type="password" required minLength={mode === "signup" ? 6 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"} value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 6 characters" : "Your password"} className={inputClass} />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50">
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>

          <p className="text-center text-sm text-slate-500">
            {mode === "login" ? "New to BongoPrompt? " : "Already have an account? "}
            <button type="button" onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              className="text-purple-600 font-semibold hover:underline">
              {mode === "login" ? "Create an account" : "Log in"}
            </button>
          </p>

          <button type="button" onClick={onCancel}
            className="w-full text-sm text-slate-500 hover:text-slate-700 font-semibold">
            {cancelLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
