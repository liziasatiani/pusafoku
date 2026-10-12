"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SUGGESTIONS } from "@/lib/commands";
import { installLocalSpeech, localeFor, localSpeech, recognizerCtor, speakLines, stopSpeaking, type LocalSpeech, type Recognizer, type VoiceLang } from "./speech";
import styles from "./commandline.module.css";

export type Mode = "idle" | "listening" | "speaking";

type Props = {
  ask: (input: string) => string[];
  onMode?: (mode: Mode) => void;
  compact?: boolean;
  defaultLang?: VoiceLang;
};

const PREFS_KEY = "pusafoku.voice";

type Entry = { id: number; kind: "in" | "out"; text: string };

export default function CommandLine({ ask, onMode, compact, defaultLang = "en" }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [value, setValue] = useState("");
  const run = useRef(0);
  const nextId = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const recognizer = useRef<Recognizer | null>(null);
  const [local, setLocal] = useState<LocalSpeech>("unavailable");
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [lang, setLang] = useState<VoiceLang>("en");
  const [note, setNote] = useState("");

  useEffect(() => {
    let alive = true;
    void localSpeech(lang).then((state) => {
      if (alive) setLocal(state);
    });
    return () => {
      alive = false;
    };
  }, [lang]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as { speak?: boolean; lang?: string };
      if (saved.speak === true) setSpeak(true);
      setLang(saved.lang === "ka" || saved.lang === "en" ? saved.lang : defaultLang);
    } catch {
      setLang(defaultLang);
    }
  }, [defaultLang]);

  function savePrefs(next: { speak: boolean; lang: VoiceLang }) {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      return;
    }
  }

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  useEffect(() => () => {
    run.current += 1;
    recognizer.current?.stop();
    stopSpeaking();
  }, []);

  async function submit(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const id = ++run.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setEntries((list) => [...list, { id: nextId.current++, kind: "in", text: `> ${text}` }]);
    onMode?.("speaking");
    const answers = ask(text);
    for (const line of answers) {
      const lineId = nextId.current++;
      setEntries((list) => [...list, { id: lineId, kind: "out", text: "" }]);
      if (reduced) {
        setEntries((list) => list.map((e) => (e.id === lineId ? { ...e, text: line } : e)));
        continue;
      }
      for (let i = 1; i <= line.length; i += 2) {
        if (id !== run.current) return;
        setEntries((list) => list.map((e) => (e.id === lineId ? { ...e, text: line.slice(0, i + 1) } : e)));
        await new Promise((resolve) => setTimeout(resolve, 14));
      }
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    if (id !== run.current) return;
    const spoken = speak && speakLines(answers, lang, () => onMode?.("idle"));
    if (!spoken) onMode?.("idle");
  }

  async function toggleListening() {
    if (listening) {
      recognizer.current?.stop();
      return;
    }
    const Ctor = recognizerCtor();
    if (!Ctor || local === "unavailable") return;
    stopSpeaking();
    setNote("");
    if (local === "downloadable") {
      setNote("Downloading the on-device voice pack. Nothing is recorded or uploaded.");
      const installed = await installLocalSpeech(lang);
      setNote(installed ? "Voice pack installed. Tap MIC again." : "The on-device voice pack could not be installed, so the microphone stays off.");
      if (installed) setLocal("ready");
      return;
    }
    const rec = new Ctor();
    rec.processLocally = true;
    rec.lang = localeFor(lang);
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript?.trim();
      if (heard) void submit(heard);
    };
    rec.onerror = (event) => {
      setNote(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone is blocked. Allow it in the browser address bar."
          : event.error === "language-not-supported"
            ? "This language is not available on this device, so the microphone stays off."
            : event.error === "no-speech"
              ? "Heard nothing. Try again."
              : "Voice input failed. Type instead.",
      );
    };
    rec.onend = () => {
      setListening(false);
      onMode?.("idle");
    };
    recognizer.current = rec;
    setListening(true);
    onMode?.("listening");
    try {
      rec.start();
    } catch {
      setListening(false);
      onMode?.("idle");
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = value;
    setValue("");
    void submit(text);
  }

  return (
    <div className={`${styles.cli} ${compact ? styles.compact : ""}`}>
      {entries.length > 0 ? (
        <div ref={logRef} className={styles.log} aria-live="polite">
          {entries.map((e) => (
            <p key={e.id} className={e.kind === "in" ? styles.in : styles.out}>
              {e.text}
            </p>
          ))}
        </div>
      ) : null}
      <div className={styles.sugg}>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className={styles.suggBtn} onClick={() => void submit(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className={styles.voiceRow}>
        <button
          type="button"
          className={`${styles.mic} ${listening ? styles.micOn : ""}`}
          aria-pressed={listening}
          disabled={local === "unavailable"}
          onClick={() => void toggleListening()}
          title={local === "unavailable" ? "On-device speech is not available here, so the microphone is off" : "Speech is understood on this device. Audio is not sent or stored anywhere."}
        >
          {listening ? "LISTENING" : "MIC"}
        </button>
        <button type="button" className={styles.tog} aria-pressed={speak} onClick={() => { const next = !speak; setSpeak(next); if (!next) stopSpeaking(); savePrefs({ speak: next, lang }); }}>
          SPEAK REPLIES
        </button>
        <button type="button" className={styles.tog} onClick={() => { const next: VoiceLang = lang === "en" ? "ka" : "en"; setLang(next); savePrefs({ speak, lang: next }); }} title="Language for the microphone and spoken replies">
          {lang === "en" ? "EN" : "KA"}
        </button>
      </div>
      {local === "unavailable" && !note ? (
        <p className={styles.info} role="status">
          The microphone is off: this browser cannot understand {lang === "ka" ? "Georgian" : "English"} speech on the device, and audio is never sent to an outside service. Typing works.
        </p>
      ) : null}
      {note ? (
        <p className={styles.note} role="status">
          {note}
        </p>
      ) : null}
      <form className={styles.prompt} onSubmit={onSubmit}>
        <label htmlFor="cmd" className={styles.caret}>
          &gt;
        </label>
        <input id="cmd" className={styles.input} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" placeholder="Type a command. Try: start my day" />
        <button type="submit" className={styles.send}>
          SEND
        </button>
      </form>
    </div>
  );
}
