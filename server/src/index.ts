import { serve } from "@hono/node-server";

import type { Server as HttpServer } from "node:http";

import { env } from "./env";
import { attachRealtime } from "./realtime";
import { app } from "./routes";

const server = serve(
  { fetch: app.fetch, port: env.port },
  (info) => {
    // eslint-disable-next-line no-console
    console.log(`✓ excalidraw sync server on http://localhost:${info.port}`);
  },
);

attachRealtime(server as unknown as HttpServer);
