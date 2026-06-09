# Stage 1: Build lineage UI
FROM oven/bun:alpine AS ui-build
WORKDIR /ui
COPY lineage-ui/package.json lineage-ui/bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY lineage-ui/ .
RUN bun run build

# Stage 2: Artifact service
FROM oven/bun:alpine
WORKDIR /app
COPY artifact-service/package.json artifact-service/bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY artifact-service/ .
COPY --from=ui-build /ui/dist /app/lineage-ui/dist
ENV UI_DIR=/app/lineage-ui/dist
EXPOSE 8090
CMD ["bun", "run", "server.ts"]
