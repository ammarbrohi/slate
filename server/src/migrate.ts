import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "./db";

const here = dirname(fileURLToPath(import.meta.url));

const run = async () => {
  const sql = readFileSync(join(here, "schema.sql"), "utf8");
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log("✓ migrations applied");
  await pool.end();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
