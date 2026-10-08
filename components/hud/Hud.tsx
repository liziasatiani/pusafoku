"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NameIntro from "@/components/hud/NameIntro";
import CaseFile from "@/components/hud/CaseFile";
import CommandLine from "@/components/hud/CommandLine";
import DigitGlobe, { type CoreState } from "@/components/hud/DigitGlobe";
import { answer, type Results } from "@/lib/commands";
import { useLayout, type TileLayout } from "@/components/hud/useLayout";
import { MODULES } from "@/modules/registry";
import type { AnyModule, ModuleResult } from "@/modules/types";
import styles from "./hud.module.css";

const STATES: CoreState[] = ["idle", "listening", "thinking", "speaking"];
const THEME_KEY = "pusafoku.theme";
const INTRO_KEY = "pusafoku.intro";
const VIEW_KEY = "pusafoku.view";
const STATUS_IDS = ["inbox", "monitor", "rss", "tasks"];
type View = "wall" | "line";
type Theme = "system" | "dark" | "light";

function resultFor(mod: AnyModule, demo: boolean, live: Record<string, ModuleResult<unknown>>): ModuleResult<unknown> {
  if (demo || mod.manifest.always) {
    return { status: "ok", data: mod.demo(), fetchedAt: new Date().toISOString() };
  }
  return live[mod.manifest.id] ?? { status: "not_connected", hint: "Loading" };
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export default function Hud() {
  const defaults = useMemo<TileLayout[]>(() => MODULES.map((m) => ({ id: m.manifest.id, hidden: false, size: m.manifest.size })), []);
  const { layout, move, resize, toggle, reset } = useLayout(defaults);
  const [demo, setDemo] = useState(false);
  const [edit, setEdit] = useState(false);
  const [kiosk, setKiosk] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [coreState, setCoreState] = useState<CoreState>("idle");
  const [view, setView] = useState<View | null>(null);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, ModuleResult<unknown>>>({});
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "f" || event.key === "F") setKiosk((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    if (kiosk) {
      el.requestFullscreen?.().catch(() => undefined);
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
  }, [kiosk]);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setKiosk(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
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

  useEffect(() => {
    if (demo) return;
    const timers = MODULES.filter((m) => !m.manifest.always).map((m) => {
      void load(m.manifest.id);
      return window.setInterval(() => void load(m.manifest.id), Math.max(30, m.manifest.refreshSeconds) * 1000);
    });
    return () => timers.forEach((t) => window.clearInterval(t));
  }, [demo, load]);

  const byId = new Map(MODULES.map((m) => [m.manifest.id, m]));
  const results = useMemo<Results>(() => new Map(MODULES.map((m) => [m.manifest.id, resultFor(m, demo, live)])), [demo, live]);
  const fileMod = openFile ? byId.get(openFile) : undefined;
  const fileResult = openFile ? results.get(openFile) : undefined;
  const ask = (input: string) => answer(input, MODULES, results, demo);
  const visible = layout.filter((t) => !t.hidden);
  const hidden = layout.filter((t) => t.hidden);
  const sizeClass = { S: styles.sizeS, M: styles.sizeM, L: styles.sizeL } as const;

  return (
    <div className={`${styles.root} ${kiosk ? styles.kiosk : ""}`} data-ready={!intro}>
      {intro ? <NameIntro onDone={finishIntro} /> : null}
      <header className={styles.bar}>
        <h1 className={styles.brand}>PUSAFOKU</h1>
        <div className={styles.controls}>
          <button type="button" className={styles.chip} aria-pressed={demo} onClick={() => setDemo((v) => !v)}>
            DEMO
          </button>
          <button type="button" className={styles.chip} aria-pressed={edit} onClick={() => setEdit((v) => !v)}>
            LAYOUT
          </button>
          <button type="button" className={styles.chip} onClick={switchView} title="Switch between the wall and the command line">
            {view === "line" ? "WALL" : "LINE"}
          </button>
          <button type="button" className={styles.chip} aria-pressed={kiosk} onClick={() => setKiosk((v) => !v)} title="Kiosk mode (F)">
            KIOSK
          </button>
          <button type="button" className={styles.chip} onClick={() => setIntro(true)} title="Replay the opening">
            INTRO
          </button>
          <button type="button" className={styles.chip} onClick={cycleTheme} title="Theme">
            {theme.toUpperCase()}
          </button>
        </div>
      </header>

      {edit && hidden.length > 0 ? (
        <div className={styles.controls} aria-label="Hidden panels">
          {hidden.map((t) => (
            <button key={t.id} type="button" className={styles.chip} onClick={() => toggle(t.id)}>
              + {byId.get(t.id)?.manifest.name}
            </button>
          ))}
          <button type="button" className={styles.chip} onClick={reset}>
            RESET
          </button>
        </div>
      ) : null}

      {view === "line" ? (
        <main className={styles.lineView}>
          <DigitGlobe state={coreState} marker={demo} className={styles.lineGlobe} />
          <ul className={styles.status}>
            {STATUS_IDS.map((id) => {
              const mod = byId.get(id);
              const result = results.get(id);
              if (!mod || !result) return null;
              return (
                <li key={id}>
                  <button type="button" className={styles.statusItem} onClick={() => setOpenFile(id)}>
                    <span className={styles.statusName}>{mod.manifest.name}</span>
                    <span className={styles.statusVal}>{result.status === "ok" ? mod.lines(result.data)[0] : "not connected"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className={styles.lineCli}>
            <CommandLine ask={ask} onBusy={(busy) => setCoreState(busy ? "speaking" : "idle")} />
          </div>
        </main>
      ) : null}

      <main className={styles.grid} hidden={view !== "wall"}>
        <section className={styles.coreTile} aria-label="Core">
          <span className={styles.stateTag} role="status" aria-live="polite">{coreState}</span>
          <div className={styles.coreStage}>
            <DigitGlobe state={coreState} marker={demo} />
          </div>
          <div className={styles.coreBar}>
            <CommandLine ask={ask} onBusy={(busy) => setCoreState(busy ? "speaking" : "idle")} compact />
            {demo ? (
              <div className={styles.stateRow}>
                {STATES.map((st) => (
                  <button key={st} type="button" className={styles.chip} aria-pressed={coreState === st} onClick={() => setCoreState(st)}>
                    {st}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {visible.map((tile) => {
          const mod = byId.get(tile.id);
          if (!mod) return null;
          const Panel = mod.Panel;
          const result = results.get(tile.id) ?? resultFor(mod, demo, live);
          return (
            <div key={tile.id} className={`${styles.tile} ${sizeClass[tile.size]}`}>
              <div className={styles.tileInner}>
                {edit ? (
                  <div className={styles.editBar}>
                    <button type="button" className={styles.editBtn} onClick={() => move(tile.id, -1)} aria-label={`Move ${mod.manifest.name} earlier`}>
                      ↑
                    </button>
                    <button type="button" className={styles.editBtn} onClick={() => move(tile.id, 1)} aria-label={`Move ${mod.manifest.name} later`}>
                      ↓
                    </button>
                    <button type="button" className={styles.editBtn} onClick={() => resize(tile.id)} aria-label={`Resize ${mod.manifest.name}`}>
                      {tile.size}
                    </button>
                    <button type="button" className={styles.editBtn} onClick={() => toggle(tile.id)} aria-label={`Hide ${mod.manifest.name}`}>
                      ✕
                    </button>
                  </div>
                ) : null}
                <button type="button" className={styles.fileBtn} onClick={() => setOpenFile(tile.id)} aria-label={`Open ${mod.manifest.name} file`}>
                  FILE
                </button>
                <div className={styles.tilePanel}>
                  <Panel result={result} demo={demo && !mod.manifest.always} refresh={() => void load(tile.id)} />
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {fileMod && fileResult ? <CaseFile mod={fileMod} result={fileResult} demo={demo} onClose={() => setOpenFile(null)} /> : null}

      <aside className={styles.cost} aria-label="Usage cost">
        {demo ? "Today $0.04 · month $1.12 (demo)" : "Cost: no data yet"}
      </aside>
    </div>
  );
}
