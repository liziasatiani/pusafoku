import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import more from "@/components/hud/agents.module.css";
import { useTr } from "@/components/hud/lang";
import type { AgentCounts, AgentInfo } from "@/lib/agents";
import type { Tr } from "@/lib/i18n";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = {
  tree: (AgentInfo & { depth: number })[];
  counts: AgentCounts;
  messages: { from: string; to: string; kind: string; body: string; ago: string }[];
};

const STATUS_LABEL: Record<AgentInfo["status"], string> = { idle: "idle", working: "working", waiting: "waiting for you", error: "needs a look" };

function ModulePanel({ result }: PanelProps<Data>) {
  const tr = useTr();
  if (result.status !== "ok") {
    return <Panel title="Agents" status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const { tree, counts, messages } = result.data;
  return (
    <Panel title="Agents">
      {tree.length === 0 ? (
        <p className={styles.sub}>{tr("No agents yet.")}</p>
      ) : (
        <>
          <p className={styles.meta}>
            {tr(counts.agents === 1 ? "{n} agent" : "{n} agents", { n: counts.agents })} · {tr(counts.subAgents === 1 ? "{n} sub-agent" : "{n} sub-agents", { n: counts.subAgents })} · {tr("{n} working", { n: counts.working })}
          </p>
          <ul className={more.list}>
            {tree.map((a) => (
              <li key={a.slug} className={more.row} style={{ paddingLeft: `${a.depth * 14}px` }}>
                <span className={`${more.dot} ${more[a.status]}`} role="img" aria-label={tr(STATUS_LABEL[a.status])} />
                <span className={more.what}>
                  <span className={more.name}>{a.name}</span> <span className={styles.meta}>{a.project}</span>
                  <span className={more.task}>{a.task || tr(STATUS_LABEL[a.status])}</span>
                </span>
              </li>
            ))}
          </ul>
          {messages.length > 0 ? (
            <>
              <h3 className={more.heading}>{tr("Latest messages")}</h3>
              <ul className={more.log}>
                {messages.map((m, i) => (
                  <li key={i}>
                    <span className={styles.meta}>
                      {m.from} → {m.to} · {m.ago}
                    </span>{" "}
                    {m.body}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </Panel>
  );
}

function toLines(data: Data, tr: Tr): string[] {
  const { counts, tree } = data;
  if (tree.length === 0) return [tr("No agents yet.")];
  const head = [tr(counts.agents === 1 ? "{n} agent" : "{n} agents", { n: counts.agents }) + ", " + tr(counts.subAgents === 1 ? "{n} sub-agent" : "{n} sub-agents", { n: counts.subAgents }) + ", " + tr("{n} working", { n: counts.working }) + "."];
  return head.concat(tree.filter((a) => a.status !== "idle").slice(0, 4).map((a) => a.name + ": " + (a.task || tr(STATUS_LABEL[a.status]))));
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "agents",
    name: "Agents",
    description: "Every agent and sub-agent you run, what each one is doing now, and its latest messages.",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    refreshSeconds: 30,
    size: "M",
    pages: ["home"],
  },
  Panel: ModulePanel,
  lines: toLines,
  notConnectedHint: "Connect the database to see your agents.",
};

export default def;
