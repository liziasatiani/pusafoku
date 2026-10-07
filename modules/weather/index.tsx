import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { city: string; tempC: number; feelsC: number; condition: string; highC: number; lowC: number; windKmh: number };

function ModulePanel({ result, demo }: PanelProps<Data>) {
  if (result.status !== "ok") {
    return <Panel title="Sky" demo={demo} status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Sky" demo={demo}>
      <p className={styles.big + " mono"}>{Math.round(data.tempC)}°</p>
      <p className={styles.sub}>{data.city} · {data.condition}</p>
      <p className={styles.meta + " mono"}>feels {Math.round(data.feelsC)}° · H {Math.round(data.highC)}° L {Math.round(data.lowC)}° · {Math.round(data.windKmh)} km/h</p>
    </Panel>
  );
}

function toLines(data: Data): string[] {
  const out = data.city + ": " + Math.round(data.tempC) + "° " + data.condition + ", wind " + Math.round(data.windKmh) + " km/h. High " + Math.round(data.highC) + "°, low " + Math.round(data.lowC) + "°.";
  return Array.isArray(out) ? out : [out];
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "weather",
    name: "Sky",
    description: "Current conditions from Open-Meteo for the city set in Settings.",
    env: [],
    refreshSeconds: 900,
    size: "S",
  },
  Panel: ModulePanel,
  lines: toLines,
  demo: () => ({ city: "Tbilisi", tempC: 21, feelsC: 20, condition: "Clear", highC: 24, lowC: 12, windKmh: 9 }),
  notConnectedHint: "Set a city in Settings to show the weather.",
};

export default def;
