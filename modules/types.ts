import type { ComponentType } from "react";

export type ModuleResult<T> =
  | { status: "ok"; data: T; fetchedAt: string }
  | { status: "not_connected"; hint: string }
  | { status: "error"; message: string };

export type ModuleSize = "S" | "M" | "L";

export type ModuleManifest = {
  id: string;
  name: string;
  description: string;
  env: string[];
  refreshSeconds: number;
  size: ModuleSize;
  always?: boolean;
};

export type PanelProps<T> = {
  result: ModuleResult<T>;
  demo?: boolean;
  refresh?: () => void;
};

export type ModuleDef<T> = {
  manifest: ModuleManifest;
  Panel: ComponentType<PanelProps<T>>;
  demo: () => T;
  lines: (data: T) => string[];
  notConnectedHint: string;
};

export type AnyModule = {
  manifest: ModuleManifest;
  Panel: ComponentType<PanelProps<unknown>>;
  demo: () => unknown;
  lines: (data: unknown) => string[];
  notConnectedHint: string;
};

export function asAny<T>(def: ModuleDef<T>): AnyModule {
  return def as unknown as AnyModule;
}
