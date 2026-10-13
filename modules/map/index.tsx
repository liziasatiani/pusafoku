import { useRef } from "react";
import Panel from "@/components/hud/Panel";
import PlaceSearch, { type Found } from "@/components/hud/PlaceSearch";
import WorldMap, { type MapHandle, type Pin } from "@/components/hud/WorldMap";
import styles from "@/components/hud/map.module.css";
import { useTr } from "@/components/hud/lang";
import type { Tr } from "@/lib/i18n";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { home: Pin; places: (Pin & { id: string })[]; editable: boolean };

function ModulePanel({ result, refresh }: PanelProps<Data>) {
  const tr = useTr();
  const map = useRef<MapHandle>(null);
  if (result.status !== "ok") {
    return <Panel title="Map" status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const { home, places, editable } = result.data;

  async function pin(place: Found) {
    const res = await fetch("/api/places", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: place.country ? `${place.city}, ${place.country}`.slice(0, 60) : place.city.slice(0, 60), latitude: place.latitude, longitude: place.longitude }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Could not save");
    }
    refresh?.();
  }

  async function drop(id: string) {
    try {
      await fetch(`/api/places/${id}`, { method: "DELETE" });
    } finally {
      refresh?.();
    }
  }

  return (
    <Panel title="Map">
      <WorldMap home={home} pins={places} handle={map} />
      <PlaceSearch editable={editable && !!refresh} onFly={(p) => map.current?.flyTo(p.latitude, p.longitude, 9)} onPin={pin} />
      {places.length === 0 ? <p className={styles.note}>{tr("No pins yet. Find a place and press PIN.")}</p> : (
        <ul className={styles.pins}>
          {places.map((p) => (
            <li key={p.id} className={styles.pinRow}>
              <button type="button" className={styles.resultMain} onClick={() => map.current?.flyTo(p.latitude, p.longitude, 9)}>
                {p.name}
              </button>
              {editable && refresh ? (
                <button type="button" className={styles.remove} aria-label={tr("Remove pin")} onClick={() => void drop(p.id)}>
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function toLines(data: Data, tr: Tr): string[] {
  const names = data.places.map((p) => p.name);
  return [tr("Home: {name}", { name: data.home.name }), names.length === 0 ? tr("No pins on the map.") : tr("Pins: {names}", { names: names.join(", ") })];
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "map",
    name: "Map",
    description: "A zoomable world map with day and night, your city and the places you pin.",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    refreshSeconds: 600,
    size: "L",
    pages: ["map"],
    wide: true,
  },
  Panel: ModulePanel,
  lines: toLines,
  notConnectedHint: "Connect the database to pin places.",
};

export default def;
