export type VoiceLang = "en" | "ka";

export type Recognizer = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type LocalOptions = { langs: string[]; processLocally: boolean };

type RecognizerCtor = {
  new (): Recognizer;
  available?: (options: LocalOptions) => Promise<string>;
  install?: (options: LocalOptions) => Promise<boolean>;
};

export type LocalSpeech = "ready" | "downloadable" | "unavailable";

export function recognizerCtor(): RecognizerCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function localeFor(lang: VoiceLang): string {
  return lang === "ka" ? "ka-GE" : "en-US";
}

export async function localSpeech(lang: VoiceLang): Promise<LocalSpeech> {
  const Ctor = recognizerCtor();
  if (!Ctor || !("processLocally" in Ctor.prototype) || typeof Ctor.available !== "function") return "unavailable";
  try {
    const status = await Ctor.available({ langs: [localeFor(lang)], processLocally: true });
    if (status === "available") return "ready";
    return status === "downloadable" || status === "downloading" ? "downloadable" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function installLocalSpeech(lang: VoiceLang): Promise<boolean> {
  const Ctor = recognizerCtor();
  if (!Ctor || typeof Ctor.install !== "function") return false;
  try {
    return await Ctor.install({ langs: [localeFor(lang)], processLocally: true });
  } catch {
    return false;
  }
}

export function speakLines(lines: string[], lang: VoiceLang, onEnd: () => void): boolean {
  if (!("speechSynthesis" in window)) return false;
  const locale = localeFor(lang);
  const local = window.speechSynthesis.getVoices().filter((v) => v.localService);
  const voice = local.find((v) => v.lang === locale) ?? local.find((v) => v.lang.startsWith(lang));
  if (!voice) return false;
  try {
    return say(lines, locale, voice, onEnd);
  } catch {
    return false;
  }
}

function say(lines: string[], locale: string, voice: SpeechSynthesisVoice, onEnd: () => void): boolean {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(lines.map((l) => l.toLowerCase()).join(". "));
  utterance.lang = locale;
  utterance.voice = voice;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onEnd();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  window.setTimeout(finish, Math.min(60000, utterance.text.length * 90 + 3000));
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
