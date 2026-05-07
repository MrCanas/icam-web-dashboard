import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

const appRoot = process.cwd();
const repoRoot = dirname(appRoot);
const appNextDir = resolve(appRoot, ".next");
const repoNextDir = resolve(repoRoot, ".next");
const appNextAdapterDir = resolve(
  appRoot,
  "node_modules",
  "next",
  "dist",
  "build",
  "adapter",
);
const repoNextAdapterDir = resolve(
  repoRoot,
  "node_modules",
  "next",
  "dist",
  "build",
  "adapter",
);

if (!existsSync(appNextDir)) {
  console.error(`[vercel-postbuild-fix] Missing .next at ${appNextDir}`);
  process.exit(1);
}

const routesManifestPath = resolve(appNextDir, "routes-manifest.json");
const deterministicManifestPath = resolve(
  appNextDir,
  "routes-manifest-deterministic.json",
);

if (existsSync(routesManifestPath) && !existsSync(deterministicManifestPath)) {
  writeFileSync(
    deterministicManifestPath,
    readFileSync(routesManifestPath, "utf8"),
    "utf8",
  );
}

mkdirSync(repoNextDir, { recursive: true });
cpSync(appNextDir, repoNextDir, { recursive: true, force: true });

const repoDeterministicManifestPath = resolve(
  repoNextDir,
  "routes-manifest-deterministic.json",
);
if (!existsSync(repoDeterministicManifestPath) && existsSync(routesManifestPath)) {
  writeFileSync(
    repoDeterministicManifestPath,
    readFileSync(routesManifestPath, "utf8"),
    "utf8",
  );
}

// Workaround for Vercel monorepo post-build checks that resolve this path at repo root.
if (existsSync(appNextAdapterDir)) {
  mkdirSync(repoNextAdapterDir, { recursive: true });
  cpSync(appNextAdapterDir, repoNextAdapterDir, { recursive: true, force: true });
}

console.log(
  `[vercel-postbuild-fix] Ensured manifests in ${appNextDir} and ${repoNextDir}`,
);
