import { loadRules } from "./rbac";
import {
  handleWrite,
  handleRead,
  handleList,
  handleUpdate,
  handleHealth,
  handleLineage,
  handleLineageGraph,
  handleLineageTrace,
} from "./routes";
import { log } from "./logger";
import path from "node:path";
import fs from "node:fs";

loadRules();

const PORT = parseInt(process.env.PORT || "8090", 10);
const UI_DIR = process.env.UI_DIR || path.resolve(import.meta.dir, "../lineage-ui/dist");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serveStatic(pathname: string): Response | null {
  let filePath = pathname.replace(/^\/ui\/?/, "");
  if (!filePath || filePath === "/") filePath = "index.html";
  const full = path.join(UI_DIR, filePath);

  if (!full.startsWith(UI_DIR)) {
    return new Response("forbidden", { status: 403 });
  }

  if (!fs.existsSync(full)) return null;

  const ext = path.extname(full);
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  return new Response(Bun.file(full), {
    headers: { "Content-Type": mime },
  });
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const start = Date.now();
    const url = new URL(req.url);
    const agentName = req.headers.get("x-agent-name") || "unknown";

    let res: Response;
    try {
      if (url.pathname === "/health") {
        res = await handleHealth(req, agentName);
      } else if (url.pathname === "/artifacts" && req.method === "POST") {
        res = await handleWrite(req, agentName);
      } else if (url.pathname.startsWith("/artifacts/") && req.method === "GET") {
        res = await handleRead(req, agentName);
      } else if (url.pathname === "/artifacts" && req.method === "GET") {
        res = await handleList(req, agentName);
      } else if (url.pathname.startsWith("/artifacts/") && req.method === "PATCH") {
        res = await handleUpdate(req, agentName);
      } else if (url.pathname === "/lineage/graph" && req.method === "GET") {
        res = await handleLineageGraph(req, agentName);
      } else if (url.pathname.startsWith("/lineage/trace/") && req.method === "GET") {
        res = await handleLineageTrace(req, agentName);
      } else if (url.pathname.startsWith("/lineage/") && req.method === "GET") {
        res = await handleLineage(req, agentName);
      } else if (url.pathname.startsWith("/ui")) {
        const staticRes = serveStatic(url.pathname);
        res = staticRes ?? Response.json({ error: "not found", status: 404 }, { status: 404 });
      } else {
        res = Response.json({ error: "not found", status: 404 }, { status: 404 });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal error";
      log.error({ event: "request_error", method: req.method, path: url.pathname, agent: agentName, error: message }, "request_error");
      res = Response.json({ error: message, status: 500 }, { status: 500 });
    }

    const duration = Date.now() - start;
    if (url.pathname !== "/health") {
      log.info({ event: "request", method: req.method, path: url.pathname, status: res.status, agent: agentName, duration_ms: duration }, "request");
    }
    return res;
  },
});

log.info({ event: "server_start", port: PORT }, "server_start");
