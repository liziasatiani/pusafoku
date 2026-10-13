import type { ComponentType } from "react";
import type { Tr } from "@/lib/i18n";

export type ModuleResult<T> =
  | { status: "ok"; data: T; fetchedAt: string }
  | { status: "not_connected"; hint: string }
  | { status: "error"; message: string };

export type ModuleSize = "S" | "M" | "L";

export const PAGES = ["home", "study", "work", "archive"] as const;
export type PageId = (typeof PAGES)[number];

export type ModuleManifest = {
  id: string;
  name: string;
  description: string;
  env: string[];
  refreshSeconds: number;
  size: ModuleSize;
  pages: PageId[];
  always?: boolean;
};

export type PanelProps<T> = {
  result: ModuleResult<T>;
  refresh?: () => void;
};

export type ModuleDef<T> = {
  manifest: ModuleManifest;
  Panel: ComponentType<PanelProps<T>>;
  lines: (data: T, tr: Tr) => string[];
  notConnectedHint: string;
};

export type AnyModule = {
  manifest: ModuleManifest;
  Panel: ComponentType<PanelProps<unknown>>;
  lines: (data: unknown, tr: Tr) => string[];
  notConnectedHint: string;
};

export function asAny<T>(def: ModuleDef<T>): AnyModule {
  return def as unknown as AnyModule;
}
