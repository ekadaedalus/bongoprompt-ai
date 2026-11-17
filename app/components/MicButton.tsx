"use client";
import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any -- Web Speech API isn't in every TS DOM lib */

type Lang = "en-US" | "bn-BD";
type Support = "unknown" | "ok" | "unsupported" | "insecure";

function getRecognitionClass(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow the mic in your browser's site settings and try again.",
  "service-not-allowed": "Voice input is blocked in this browser. Try Chrome or Edge.",
  "audio-capture": "No microphone found. Plug one in or check your system sound settings.",
  "no-speech": "Didn't hear anything. Tap the mic and speak again.",
  network: "Voice service unreachable. Check your connection, or use Chrome/Edge (Brave and embedded browsers block it).",
  "language-not-supported": "This language isn't supported by your browser's voice input.",
};

/**
 * Voice input using the browser's built-in Web Speech API. Toggle between English and Bangla (bn-BD).
 * Failures are shown to the user instead of being swallowed.
 */
export default function MicButton({ onText }: { onText: (text: string) => void }) {
  const [support, setSupport] = useState<Support>("unknown");
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<Lang>("en-US");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    // Detected after mount so server and client render the same markup.
    const next: Support = !getRecognitionClass()
      ? "unsupported"
      : !window.isSecureContext
        ? "insecure"
        : "ok";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(next);
    return () => recRef.current?.abort?.();
  }, []);

  // Auto-hide transient errors.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  if (support === "unknown") return null;

  const toggle = () => {
    setError(null);
    if (support === "unsupported") {
      setError("Voice input isn't supported in this browser. Use Chrome, Edge or Safari.");
      return;
    }
    if (support === "insecure") {
      setError("Voice input needs HTTPS (or localhost). Open the site over https:// to use the mic.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }

    recRef.current?.abort?.();
    const Recognition = getRecognitionClass();
    const rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0]?.transcript ?? "";
      text = text.trim();
      if (text) onText(text);
    };
    rec.onerror = (e: any) => {
      if (e?.error !== "aborted") {
        setError(ERROR_MESSAGES[e?.error] ?? `Voice input failed (${e?.error ?? "unknown error"}).`);
      }
      setListening(false);
    };
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err: any) {
      recRef.current = null;
      setListening(false);
      setError(`Couldn't start voice input: ${err?.message ?? err}`);
    }
  };

  const disabledLook = support !== "ok";

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => setLang(lang === "en-US" ? "bn-BD" : "en-US")}
        disabled={listening}
        className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition-all"
        title="Switch voice language"
        aria-label={`Voice language: ${lang === "en-US" ? "English" : "Bangla"}. Click to switch.`}
      >
        {lang === "en-US" ? "EN" : "বাং"}
      </button>
      <button
        type="button"
        onClick={toggle}
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
          listening
            ? "bg-red-500 text-white animate-pulse shadow-lg"
            : disabledLook
              ? "bg-slate-100 opacity-50"
              : "bg-slate-100 hover:bg-slate-200"
        }`}
        title={listening ? "Stop listening" : "Speak your trip"}
        aria-label={listening ? "Stop listening" : "Speak your trip"}
        aria-pressed={listening}
      >
        🎤
      </button>
      {error && (
        <div
          role="alert"
          className="absolute top-full right-0 mt-3 w-72 z-20 rounded-xl bg-white text-slate-700 text-sm p-3 shadow-2xl border border-red-200"
        >
          {error}
        </div>
      )}
    </div>
  );
}
