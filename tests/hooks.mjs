import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const base = resolvePath(root, specifier.slice(2));
    for (const suffix of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(base + suffix)) return { url: pathToFileURL(base + suffix).href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}
