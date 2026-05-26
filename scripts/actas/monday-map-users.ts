import { config } from "dotenv";
import { resolve } from "node:path";

import { runMondayUserMapping } from "./lib/user-mapping";

config({ path: resolve(process.cwd(), ".env.local") });

runMondayUserMapping().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
