import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (typeof specifier === "string" && specifier.endsWith(".js") && context.parentURL) {
      const candidate = new URL(specifier, context.parentURL);
      if (candidate.protocol === "file:") {
        const jsPath = fileURLToPath(candidate);
        const tsPath = jsPath.replace(/\.js$/, ".ts");
        if (!existsSync(jsPath) && existsSync(tsPath)) {
          return await nextResolve(pathToFileURL(tsPath).href, context);
        }
      }
    }
    throw error;
  }
}
