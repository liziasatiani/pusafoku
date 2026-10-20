type AgentStatus = "idle" | "working" | "waiting" | "error";

export type AgentInfo = { slug: string; name: string; project: string; role: string; parent: string | null; status: AgentStatus; task: string };

export type AgentCounts = { agents: number; subAgents: number; working: number; waiting: number; failing: number };

const MAX_DEPTH = 3;

export function arrange(list: AgentInfo[]): { agent: AgentInfo; depth: number }[] {
  const known = new Set(list.map((a) => a.slug));
  const out: { agent: AgentInfo; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const agent of list) {
      const isRoot = parent === null && (agent.parent === null || !known.has(agent.parent));
      if (seen.has(agent.slug) || !(isRoot || (parent !== null && agent.parent === parent))) continue;
      seen.add(agent.slug);
      out.push({ agent, depth });
      if (depth < MAX_DEPTH) walk(agent.slug, depth + 1);
    }
  };
  walk(null, 0);
  for (const agent of list) if (!seen.has(agent.slug)) out.push({ agent, depth: MAX_DEPTH });
  return out;
}

export function counts(list: AgentInfo[]): AgentCounts {
  const known = new Set(list.map((a) => a.slug));
  const isSub = (a: AgentInfo) => a.parent !== null && known.has(a.parent);
  return {
    agents: list.filter((a) => !isSub(a)).length,
    subAgents: list.filter(isSub).length,
    working: list.filter((a) => a.status === "working").length,
    waiting: list.filter((a) => a.status === "waiting").length,
    failing: list.filter((a) => a.status === "error").length,
  };
}
