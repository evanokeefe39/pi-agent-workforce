FROM oven/bun:alpine
WORKDIR /app
COPY artifact-service/package.json artifact-service/bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY artifact-service/ .
EXPOSE 8090
CMD ["bun", "run", "server.ts"]
