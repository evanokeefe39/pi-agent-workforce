#!/usr/bin/env node
/**
 * Patch pi-otel pickByProtocol to append signal-specific URL paths for HTTP.
 *
 * Root cause: pickByProtocol passes cfg.endpoint as constructor `url` to OTel
 * HTTP exporters. The SDK uses `url` as-is (no path appended). This means
 * traces, metrics, and logs all hit the base endpoint instead of
 * /v1/traces, /v1/metrics, /v1/logs respectively.
 *
 * gRPC is unaffected — it uses service definitions, not URL paths.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const candidates = [
  join(homedir(), ".pi", "agent", "npm", "node_modules", "pi-otel", "dist", "otel", "sdk.js"),
  "/root/.pi/agent/npm/node_modules/pi-otel/dist/otel/sdk.js",
];
const target = candidates.find(p => existsSync(p));
if (!target) {
  console.log("pi-otel not found, skipping patch");
  process.exit(0);
}

let src = readFileSync(target, "utf8");

if (src.includes("signalPath")) {
  console.log("pi-otel already patched");
  process.exit(0);
}

// Replace the pickByProtocol function to accept and use signalPath
src = src.replace(
  `function pickByProtocol(cfg, ctors) {
    const opts = { url: cfg.endpoint, headers: cfg.headers };`,
  `function pickByProtocol(cfg, ctors, signalPath) {
    const url = (cfg.protocol !== "grpc" && signalPath) ? cfg.endpoint.replace(/\\/+$/, "") + signalPath : cfg.endpoint;
    const opts = { url, headers: cfg.headers };`
);

// Add signal paths to each call site
src = src.replace(
  /const traceExporter = pickByProtocol\(cfg, \{\s*grpc: GrpcExporter,\s*proto: ProtoExporter,\s*http: HttpExporter,\s*\}\);/,
  `const traceExporter = pickByProtocol(cfg, {
        grpc: GrpcExporter,
        proto: ProtoExporter,
        http: HttpExporter,
    }, "/v1/traces");`
);

src = src.replace(
  /const metricExporter = pickByProtocol\(cfg, \{\s*grpc: MetricGrpcExporter,\s*proto: MetricProtoExporter,\s*http: MetricHttpExporter,\s*\}\);/,
  `const metricExporter = pickByProtocol(cfg, {
            grpc: MetricGrpcExporter,
            proto: MetricProtoExporter,
            http: MetricHttpExporter,
        }, "/v1/metrics");`
);

src = src.replace(
  /const logExporter = pickByProtocol\(cfg, \{\s*grpc: LogGrpcExporter,\s*proto: LogProtoExporter,\s*http: LogHttpExporter,\s*\}\);/,
  `const logExporter = pickByProtocol(cfg, {
            grpc: LogGrpcExporter,
            proto: LogProtoExporter,
            http: LogHttpExporter,
        }, "/v1/logs");`
);

writeFileSync(target, src);
console.log("pi-otel: patched pickByProtocol with signal-specific URL paths");
