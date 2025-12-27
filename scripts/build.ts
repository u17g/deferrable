import { $ } from "bun";
import { rename, rm } from "node:fs/promises";

// ESM + types
await $`bun x tsc -p tsconfig.build.json`;

// CJS (emitted as .js into dist-cjs/)
await $`bun x tsc -p tsconfig.build.cjs.json`;

// In a "type": "module" package, CommonJS output must use the .cjs extension.
await rename("./dist-cjs/index.js", "./dist/index.cjs");
await rename("./dist-cjs/index.js.map", "./dist/index.cjs.map").catch(() => { });

// Cleanup intermediate dir
await rm("./dist-cjs", { recursive: true, force: true });


