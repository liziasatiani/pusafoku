"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import { useLang, useTr } from "@/components/hud/lang";
import { localeFor, type Tr } from "@/lib/i18n";
import type { ModuleDef } from "@/modules/types";

export type Data = { timeZone: string; name: string };

function greetingKey(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Clock({ timeZone, name }: Data) {
  const tr = useTr();
  const lang = useLang();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <p className={styles.big + " mono"}>--:--</p>;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now);
  const date = new Intl.DateTimeFormat(lang === "ka" ? "ka-GE" : "en-GB", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(now);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(now));
  return (
    <>
      <p className={styles.big + " mono"}>{time}</p>
      <p className={styles.sub}>{date}</p>
      <p className={styles.meta}>{tr(greetingKey(hour))}, {name}</p>
    </>
  );
}

function toLines(data: Data, tr: Tr): string[] {
  const when = new Intl.DateTimeFormat(localeFor(tr), { timeZone: data.timeZone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  return [tr("It is {when} in {place}.", { when, place: data.timeZone.split("/").pop() ?? "" })];
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "clock",
    name: "Clock",
    description: "Time, date and the day's greeting.",
    env: [],
    refreshSeconds: 1,
    size: "S",
    always: true,
  },
  Panel: ({ result }) =>
    result.status === "ok" ? (
      <Panel title="Clock">
        <Clock timeZone={result.data.timeZone} name={result.data.name} />
      </Panel>
    ) : null,
  lines: toLines,
  notConnectedHint: "",
};

export default def;
