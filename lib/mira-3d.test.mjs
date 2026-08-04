import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { OPEN_SOURCE_MIRA_URL } from "./mira-3d.js";

test("open-source Mira asset is a commit-pinned GLB", () => {
  const url = new URL(OPEN_SOURCE_MIRA_URL);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "cdn.jsdelivr.net");
  assert.match(url.pathname, /@([0-9a-f]{40})\/avatars\/mpfb\.glb$/);
  assert.doesNotMatch(url.pathname, /@(main|master|latest)\//);
});

test("managed site loads the photoreal presentation layer", async () => {
  const layout = await readFile(new URL("../app/layout.jsx", import.meta.url), "utf8");
  const css = await readFile(
    new URL("../app/mira-photoreal.css", import.meta.url),
    "utf8",
  );

  assert.match(layout, /import "\.\/mira-photoreal\.css";/);
  assert.match(css, /FICTIONAL AI EDUCATOR/);
  assert.match(css, /Hong Kong-inspired design/);
});

test("runtime retains an explicit lightweight fallback", async () => {
  const runtime = await readFile(new URL("./mira-3d.js", import.meta.url), "utf8");
  assert.match(runtime, /legacy-fallback/);
  assert.match(runtime, /preferOpenSourcePhotoreal/);
  assert.match(runtime, /inspectRig\(head\)/);
});
