import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import { useTr } from "@/components/hud/lang";
import type { Tr } from "@/lib/i18n";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { city: string; tempC: number; feelsC: number; condition: string; highC: number; lowC: number; windKmh: number };

function ModulePanel({ result }: PanelProps<Data>) {
  const tr = useTr();
  if (result.status !== "ok") {
    return <Panel title="Sky" status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Sky">
      <p className={styles.big + " mono"}>{Math.round(data.tempC)}°</p>
      <p className={styles.sub}>{data.city} · {tr(data.condition)}</p>
      <p className={styles.meta + " mono"}>{tr("feels {feels}° · H {high}° L {low}° · {wind} km/h", { feels: Math.round(data.feelsC), high: Math.round(data.highC), low: Math.round(data.lowC), wind: Math.round(data.windKmh) })}</p>
    </Panel>
  );
}

function toLines(data: Data, tr: Tr): string[] {
  return [tr("{city}: {temp}° {condition}, wind {wind} km/h. High {high}°, low {low}°.", { city: data.city, temp: Math.round(data.tempC), condition: tr(data.condition), wind: Math.round(data.windKmh), high: Math.round(data.highC), low: Math.round(data.lowC) })];
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "weather",
    name: "Sky",
    description: "Current conditions from Open-Meteo for the city set in Settings.",
    env: [],
    refreshSeconds: 900,
    size: "S",
    pages: ["home"],
  },
  Panel: ModulePanel,
  lines: toLines,
  notConnectedHint: "Set a city in Settings to show the weather.",
};

export default def;
