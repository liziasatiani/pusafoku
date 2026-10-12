"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Settings } from "@/lib/defaults";
import styles from "./settings.module.css";

export type LiveSettings = Settings & { latitude: number; longitude: number; editable: boolean };

type Place = { city: string; country: string; latitude: number; longitude: number; timeZone: string };

const CURRENCIES = ["GEL", "USD", "EUR", "GBP"];

type Props = {
  current: LiveSettings;
  onClose: () => void;
  onSaved: () => void;
};

export default function SettingsDialog({ current, onClose, onSaved }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState(current.name);
  const [language, setLanguage] = useState<"en" | "ka">(current.language);
  const [currency, setCurrency] = useState(current.currency);
  const [place, setPlace] = useState({ city: current.city, latitude: current.latitude, longitude: current.longitude, timeZone: current.timeZone });
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Place[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setFound([]);
    try {
      const res = await fetch(`/api/settings/search?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as { places?: Place[]; error?: string };
      if (!res.ok) setMessage(data.error ?? "Search failed");
      else if (!data.places || data.places.length === 0) setMessage("No place found with that name");
      else setFound(data.places);
    } catch {
      setMessage("Could not reach the server");
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, language, city: place.city, latitude: place.latitude, longitude: place.longitude, timeZone: place.timeZone, currency }),
      });
      if (res.ok) {
        onSaved();
        onClose();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? "Could not save");
    } catch {
      setMessage("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Settings" onClick={(event) => event.stopPropagation()}>
        <header className={styles.head}>
          <h2 className={styles.title}>SETTINGS</h2>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose}>
            CLOSE
          </button>
        </header>
        {!current.editable ? <p className={styles.note}>Connect the database to save settings. These are the defaults.</p> : null}
        <form className={styles.form} onSubmit={save}>
          <label className={styles.field}>
            Name
            <input className={styles.control} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoComplete="off" />
          </label>
          <div className={styles.row}>
            <label className={styles.field}>
              Language
              <select className={styles.control} value={language} onChange={(e) => setLanguage(e.target.value === "ka" ? "ka" : "en")}>
                <option value="en">English</option>
                <option value="ka">Georgian</option>
              </select>
            </label>
            <label className={styles.field}>
              Currency
              <select className={styles.control} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={styles.place}>
            City: <strong>{place.city}</strong> <span className="mono">{place.timeZone}</span>
          </p>
          <div className={styles.search}>
            <input className={styles.control} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find another city" aria-label="Find another city" maxLength={80} autoComplete="off" />
            <button type="button" className={styles.find} disabled={query.trim().length < 2} onClick={(e) => void search(e)}>
              FIND
            </button>
          </div>
          {found.length > 0 ? (
            <ul className={styles.results}>
              {found.map((p) => (
                <li key={`${p.latitude},${p.longitude}`}>
                  <button type="button" className={styles.result} onClick={() => { setPlace({ city: p.city, latitude: p.latitude, longitude: p.longitude, timeZone: p.timeZone }); setFound([]); setQuery(""); }}>
                    {p.city}
                    {p.country ? `, ${p.country}` : ""} <span className="mono">{p.timeZone}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {message ? (
            <p className={styles.error} role="alert">
              {message}
            </p>
          ) : null}
          <button type="submit" className={styles.save} disabled={busy || !current.editable}>
            {busy ? "SAVING" : "SAVE"}
          </button>
        </form>
      </div>
    </div>
  );
}
