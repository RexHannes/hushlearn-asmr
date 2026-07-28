import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "app"), { recursive: true });

await Promise.all([
  cp(resolve(root, "index.html"), resolve(output, "index.html")),
  cp(resolve(root, "static-app.js"), resolve(output, "static-app.js")),
  cp(resolve(root, ".nojekyll"), resolve(output, ".nojekyll")),
  cp(resolve(root, "app/globals.css"), resolve(output, "app/globals.css")),
  cp(resolve(root, "lib"), resolve(output, "lib"), { recursive: true }),
  cp(resolve(root, "public"), resolve(output, "public"), { recursive: true }),
]);

console.log("Static Hushlearn build written to dist/");
