"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NameIntro from "@/components/hud/NameIntro";
import CaseFile from "@/components/hud/CaseFile";
import CommandLine, { type Mode } from "@/components/hud/CommandLine";
import DigitGlobe, { type CoreState } from "@/components/hud/DigitGlobe";
import SettingsDialog, { type LiveSettings } from "@/components/hud/SettingsDialog";
import { LangContext } from "@/components/hud/lang";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { translate, type Vars } from "@/lib/i18n";
import { answer, type Results } from "@/lib/commands";
import { MODULES } from "@/modules/registry";
import { PAGES, type AnyModule, type ModuleResult, type PageId } from "@/modules/types";
import styles from "./hud.module.css";

const THEME_KEY = "pusafoku.theme";
const INTRO_KEY = "pusafoku.intro";
const VIEW_KEY = "pusafoku.view";
const STATUS_IDS = ["inbox", "monitor", "rss", "tasks"];
type View = "wall" | "line";

function pageFromHash(): PageId {
  const hash = window.location.hash.replace("#", "");
  return PAGES.find((p) => p === hash) ?? "home";
}
type Theme = "system" | "dark" | "light";

const FALLBACK_SETTINGS: LiveSettings = { ...DEFAULT_SETTINGS, latitude: 41.7151, longitude: 44.8271, editable: false };

function resultFor(mod: AnyModule, live: Record<string, ModuleResult<unknown>>, settings: LiveSettings): ModuleResult<unknown> {
  if (mod.manifest.id === "clock") {
    return { status: "ok", data: { timeZone: settings.timeZone, name: settings.name }, fetchedAt: new Date().toISOString() };
  }
  return live[mod.manifest.id] ?? { status: "not_connected", hint: "Loading" };
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export default function Hud() {
  const [theme, setTheme] = useState<Theme>("system");
  const [coreState, setCoreState] = useState<CoreState>("idle");
  const [view, setView] = useState<View | null>(null);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, ModuleResult<unknown>>>({});
  const [settings, setSettings] = useState<LiveSettings>(FALLBACK_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [page, setPage] = useState<PageId>("home");
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(VIEW_KEY);
    } catch {
      saved = null;
    }
    if (saved === "wall" || saved === "line") setView(saved);
    else setView(window.matchMedia("(max-width: 759px)").matches ? "line" : "wall");
  }, []);

  useEffect(() => {
    const sync = () => setPage(pageFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function go(next: PageId) {
    window.location.hash = next === "home" ? "" : next;
    setPage(next);
    window.scrollTo({ top: 0 });
  }

  function switchView() {
    const next: View = view === "line" ? "wall" : "line";
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      return;
    }
  }

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(INTRO_KEY) === "1") setIntro(false);
    } catch {
      return;
    }
  }, []);

  function finishIntro() {
    setIntro(false);
    try {
      window.sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      return;
    }
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        applyTheme(saved);
      }
    } catch {
      return;
    }
  }, []);

  function cycleTheme() {
    const next: Theme = theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
    setTheme(next);
    applyTheme(next);
    try {
      if (next === "system") window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, next);
    } catch {
      return;
    }
  }

  const load = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/modules/${id}`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.assign("/login");
        return;
      }
      const result = (await res.json()) as ModuleResult<unknown>;
      setLive((current) => ({ ...current, [id]: result }));
    } catch {
      setLive((current) => ({ ...current, [id]: { status: "error", message: "Could not reach the server" } }));
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (res.ok) setSettings((await res.json()) as LiveSettings);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const timers = MODULES.filter((m) => !m.manifest.always).map((m) => {
      void load(m.manifest.id);
      return window.setInterval(() => void load(m.manifest.id), Math.max(30, m.manifest.refreshSeconds) * 1000);
    });
    return () => timers.forEach((t) => window.clearInterval(t));
  }, [load]);

  const byId = new Map(MODULES.map((m) => [m.manifest.id, m]));
  const results = useMemo<Results>(() => new Map(MODULES.map((m) => [m.manifest.id, resultFor(m, live, settings)])), [live, settings]);
  const fileMod = openFile ? byId.get(openFile) : undefined;
  const fileResult = openFile ? results.get(openFile) : undefined;
  const lang = settings.language;
  const tr = (text: string, vars?: Vars) => translate(lang, text, vars);
  const ask = (input: string) => answer(input, MODULES, results, lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const onMode = (mode: Mode) => setCoreState(mode === "listening" ? "listening" : mode === "speaking" ? "speaking" : "idle");
  const sizeClass = { S: styles.sizeS, M: styles.sizeM, L: styles.sizeL } as const;

  return (
    <LangContext.Provider value={lang}>
      <div className={styles.root} data-ready={!intro}>
        {intro ? <NameIntro onDone={finishIntro} /> : null}
        <header className={styles.bar}>
          <h1 className={styles.brand}>PUSAFOKU</h1>
          <div className={styles.controls}>
            {page === "home" ? (
              <button type="button" className={styles.chip} onClick={switchView} title={tr("Switch between the wall and the command line")}>
                {tr(view === "line" ? "WALL" : "LINE")}
              </button>
            ) : null}
            <button type="button" className={styles.chip} onClick={() => setShowSettings(true)}>
              {tr("SETTINGS")}
            </button>
            <button type="button" className={styles.chip} onClick={cycleTheme} title={tr("Theme")}>
              {tr(theme.toUpperCase())}
            </button>
          </div>
        </header>

        <nav className={styles.pageNav} aria-label={tr("Pages")}>
          {PAGES.map((id) => (
            <button key={id} type="button" className={styles.tab} aria-current={page === id ? "page" : undefined} onClick={() => go(id)}>
              {tr(id.toUpperCase())}
            </button>
          ))}
        </nav>

        {page !== "home" ? (
          <main className={styles.pageGrid}>
            <section className={styles.pageCli} aria-label={tr("Core")}>
              <div className={styles.coreBar}>
                <CommandLine ask={ask} onMode={onMode} defaultLang={settings.language} compact />
              </div>
            </section>
            {MODULES.filter((mod) => mod.manifest.pages.includes(page)).map((mod) => {
              const Panel = mod.Panel;
              const result = results.get(mod.manifest.id) ?? resultFor(mod, live, settings);
              return (
                <div key={mod.manifest.id} className={styles.tile}>
                  <div className={styles.tileInner}>
                    <button type="button" className={styles.fileBtn} onClick={() => setOpenFile(mod.manifest.id)} aria-label={tr("Open {name} file", { name: tr(mod.manifest.name) })}>
                      {tr("FILE")}
                    </button>
                    <div className={styles.tilePanel}>
                      <Panel result={result} refresh={() => void load(mod.manifest.id)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </main>
        ) : null}

        {page === "home" && view === "line" ? (
          <main className={styles.lineView}>
            <DigitGlobe state={coreState} className={styles.lineGlobe} />
            <ul className={styles.status}>
              {STATUS_IDS.map((id) => {
                const mod = byId.get(id);
                const result = results.get(id);
                if (!mod || !result) return null;
                return (
                  <li key={id}>
                    <button type="button" className={styles.statusItem} onClick={() => setOpenFile(id)}>
                      <span className={styles.statusName}>{tr(mod.manifest.name)}</span>
                      <span className={styles.statusVal}>{result.status === "ok" ? mod.lines(result.data, tr)[0] : tr("Not connected")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className={styles.lineCli}>
              <CommandLine ask={ask} onMode={onMode} defaultLang={settings.language} />
            </div>
          </main>
        ) : null}

        <main className={styles.grid} hidden={page !== "home" || view !== "wall"}>
          <section className={styles.coreTile} aria-label={tr("Core")}>
            <span className={styles.stateTag} role="status" aria-live="polite">{tr(coreState)}</span>
            <div className={styles.coreStage}>
              <DigitGlobe state={coreState} />
            </div>
            <div className={styles.coreBar}>
              <CommandLine ask={ask} onMode={onMode} defaultLang={settings.language} compact />
            </div>
          </section>

          {MODULES.filter((mod) => mod.manifest.pages.includes("home")).map((mod) => {
            const tile = { id: mod.manifest.id, size: mod.manifest.size };
            const Panel = mod.Panel;
            const result = results.get(tile.id) ?? resultFor(mod, live, settings);
            return (
              <div key={tile.id} className={`${styles.tile} ${sizeClass[tile.size]}`}>
                <div className={styles.tileInner}>
                  <button type="button" className={styles.fileBtn} onClick={() => setOpenFile(tile.id)} aria-label={tr("Open {name} file", { name: tr(mod.manifest.name) })}>
                    {tr("FILE")}
                  </button>
                  <div className={styles.tilePanel}>
                    <Panel result={result} refresh={() => void load(tile.id)} />
                  </div>
                </div>
              </div>
            );
          })}
        </main>

        {showSettings ? (
          <SettingsDialog
            current={settings}
            onClose={() => setShowSettings(false)}
            onSaved={() => {
              void loadSettings();
              void load("weather");
              void load("calendar");
              void load("notes");
            }}
          />
        ) : null}

        {fileMod && fileResult ? <CaseFile mod={fileMod} result={fileResult} onClose={() => setOpenFile(null)} /> : null}
      </div>
    </LangContext.Provider>
  );
}
