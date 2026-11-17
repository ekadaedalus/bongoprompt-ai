"use client";
import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any -- Web Speech API isn't in every TS DOM lib */

type Lang = "en-US" | "bn-BD";

function getRecognitionClass(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/**
 * Voice input using the browser's built-in Web Speech API. Renders nothing in browsers that
 * don't support it. Toggle between English and Bangla (bn-BD).
 */
export default function MicButton({ onText }: { onText: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<Lang>("en-US");
  const recRef = useRef<any>(null);

  useEffect(() => {
    // Detected after mount so server and client render the same markup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!getRecognitionClass());
    return () => recRef.current?.abort?.();
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Recognition = getRecognitionClass();
    const rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results as ArrayLike<any>)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setLang(lang === "en-US" ? "bn-BD" : "en-US")}
        className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
        title="Switch voice language"
        aria-label={`Voice language: ${lang === "en-US" ? "English" : "Bangla"}. Click to switch.`}
      >
        {lang === "en-US" ? "EN" : "বাং"}
      </button>
      <button
        type="button"
        onClick={toggle}
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
          listening ? "bg-red-500 text-white animate-pulse shadow-lg" : "bg-slate-100 hover:bg-slate-200"
        }`}
        title={listening ? "Stop listening" : "Speak your trip"}
        aria-label={listening ? "Stop listening" : "Speak your trip"}
      >
        🎤
      </button>
    </div>
  );
}
