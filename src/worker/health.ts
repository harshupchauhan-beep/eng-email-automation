import http from "node:http";
import { pingDatabase } from "../lib/db";
import { pingRedis } from "../lib/queue/redis";
import { getEnv } from "../lib/env";
import { logger } from "../lib/logger";

export function startWorkerHealthServer() {
  const port = getEnv().WORKER_HEALTH_PORT;
  const server = http.createServer(async (req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, role: "worker", pid: process.pid }));
      return;
    }
    if (req.url === "/ready") {
      try {
        await pingDatabase();
        const redis = await pingRedis();
        if (!redis) throw new Error("redis down");
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(error) }));
      }
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, "0.0.0.0", () => {
    logger.info({ port }, "worker health server listening");
  });
  return server;
}
