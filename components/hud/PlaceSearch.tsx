"use client";

import { useState, type FormEvent } from "react";
import { useTr } from "./lang";
import styles from "./map.module.css";

export type Found = { city: string; country: string; latitude: number; longitude: number; timeZone: string };

type Props = { editable: boolean; onFly: (place: Found) => void; onPin: (place: Found) => Promise<void> };

export default function PlaceSearch({ editable, onFly, onPin }: Props) {
  const tr = useTr();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setMessage("");
    setFound([]);
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/search?q=${encodeURIComponent(query.trim())}`);
      const data = (await res.json()) as { places?: Found[]; error?: string };
      if (!res.ok) setMessage(tr(data.error ?? "Search failed"));
      else if (!data.places || data.places.length === 0) setMessage(tr("No place found with that name"));
      else setFound(data.places);
    } catch {
      setMessage(tr("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  }

  async function pin(place: Found) {
    setBusy(true);
    try {
      await onPin(place);
      setFound([]);
      setQuery("");
    } catch (error) {
      setMessage(tr(error instanceof Error ? error.message : "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.search}>
      <form className={styles.searchRow} onSubmit={(e) => void search(e)}>
        <input className={styles.control} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("Find a place")} aria-label={tr("Find a place")} maxLength={80} autoComplete="off" />
        <button type="submit" className={styles.btn} disabled={busy || query.trim().length < 2}>
          {tr("FIND")}
        </button>
      </form>
      {found.length > 0 ? (
        <ul className={styles.results}>
          {found.map((place) => (
            <li key={`${place.latitude},${place.longitude}`} className={styles.result}>
              <button type="button" className={styles.resultMain} onClick={() => onFly(place)}>
                {place.city}
                {place.country ? `, ${place.country}` : ""}
              </button>
              {editable ? (
                <button type="button" className={styles.btn} disabled={busy} onClick={() => void pin(place)}>
                  {tr("PIN")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <p className={styles.error} role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
