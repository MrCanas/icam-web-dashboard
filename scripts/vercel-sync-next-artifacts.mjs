import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const appNextDir = resolve(repoRoot, "icam-web-dashboard", ".next");
const rootNextDir = resolve(repoRoot, ".next");

if (!existsSync(appNextDir)) {
  console.error(`[vercel-sync] Missing source directory: ${appNextDir}`);
  process.exit(1);
}

if (existsSync(rootNextDir)) {
  rmSync(rootNextDir, { recursive: true, force: true });
}

mkdirSync(rootNextDir, { recursive: true });
cpSync(appNextDir, rootNextDir, { recursive: true });

const routesManifestPath = resolve(rootNextDir, "routes-manifest.json");
const deterministicRoutesManifestPath = resolve(
  rootNextDir,
  "routes-manifest-deterministic.json",
);

if (existsSync(routesManifestPath)) {
  writeFileSync(
    deterministicRoutesManifestPath,
    readFileSync(routesManifestPath, "utf8"),
    "utf8",
  );
}

console.log(`[vercel-sync] Synced ${appNextDir} -> ${rootNextDir}`);
