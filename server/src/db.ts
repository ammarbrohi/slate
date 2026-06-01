import pg from "pg";

import { env } from "./env";

// pg returns BYTEA as Node Buffer by default — good.
export const pool = new pg.Pool({ connectionString: env.databaseUrl });

export const query = <T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
) => pool.query<T>(text, params as any[]);
