# ============================================================
# BASE — shared by all agents
# Node for Pi CLI, Bun for server runtime
# ============================================================
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates curl unzip && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent
RUN curl -fsSL https://bun.sh/install | bash && ln -s /root/.bun/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --production
COPY server.ts logger.mjs ./
COPY extensions/artifacts/ /root/.pi/agent/extensions/artifacts/
COPY extensions/deep-research/ /root/.pi/agent/extensions/deep-research/
COPY extensions/duckdb/ /root/.pi/agent/extensions/duckdb/
COPY extensions/web-fetch.ts /root/.pi/agent/extensions/web-fetch.ts
COPY extensions/web-scrape/ /root/.pi/agent/extensions/web-scrape/
COPY extensions/web-search.ts /root/.pi/agent/extensions/web-search.ts
COPY extensions/workproduct-lib/ /root/.pi/agent/extensions/workproduct-lib/
COPY extensions/writing-style/ /root/.pi/agent/extensions/writing-style/
RUN pi extensions install || true
ENV WORKSPACE_DIR=/workspace
RUN mkdir -p /workspace
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["bun", "run", "server.ts"]

# ============================================================
# PLANNER — orchestration only (subagent-http + artifact read)
# Builds from node directly, NOT from base, to avoid inheriting
# research/scraping tools. Planner must delegate, never do work itself.
# ============================================================
FROM node:22-slim AS planner
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates curl unzip && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent
RUN curl -fsSL https://bun.sh/install | bash && ln -s /root/.bun/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --production
COPY server.ts logger.mjs ./
COPY extensions/artifacts/ /root/.pi/agent/extensions/artifacts/
COPY extensions/subagent-http/ /root/.pi/agent/extensions/subagent-http/
RUN cd /root/.pi/agent/extensions/subagent-http && npm install --omit=dev 2>/dev/null || true
COPY planner/.pi/agent/ /root/.pi/agent/
COPY planner/agent.json /app/planner/agent.json
RUN pi extensions install || true
RUN mkdir -p /workspace
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["bun", "run", "server.ts"]

# ============================================================
# LIGHTWEIGHT AGENTS — ceo, coder, qa, publisher
# ============================================================
FROM base AS ceo
COPY ceo/.pi/agent/ /root/.pi/agent/
COPY ceo/agent.json /app/ceo/agent.json

# ============================================================
# CODER — rendering toolchain (Chromium + React + Playwright)
# ============================================================
FROM base AS coder-deps
RUN apt-get update && apt-get install -y --no-install-recommends chromium && rm -rf /var/lib/apt/lists/*
RUN npm init -y && npm install playwright-core react react-dom tailwindcss @tailwindcss/cli

FROM coder-deps AS coder
COPY coder/.pi/agent/ /root/.pi/agent/
COPY coder/agent.json /app/coder/agent.json
COPY skills/brand-guidelines/ /root/.pi/agent/skills/brand-guidelines/
COPY skills/platform-formats/ /root/.pi/agent/skills/platform-formats/

FROM base AS qa
COPY qa/.pi/agent/ /root/.pi/agent/
COPY qa/agent.json /app/qa/agent.json
COPY skills/brand-guidelines/ /root/.pi/agent/skills/brand-guidelines/

FROM base AS publisher
COPY publisher/.pi/agent/ /root/.pi/agent/
COPY publisher/agent.json /app/publisher/agent.json
COPY skills/brand-guidelines/ /root/.pi/agent/skills/brand-guidelines/
COPY skills/platform-formats/ /root/.pi/agent/skills/platform-formats/

# ============================================================
# RESEARCHER — lightweight scraping (Python + Scrapling + Cheerio)
# ============================================================
FROM base AS researcher-deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip3 install --break-system-packages "scrapling[fetchers]"
RUN npm install -g cheerio

FROM researcher-deps AS researcher
COPY researcher/.pi/agent/ /root/.pi/agent/
COPY researcher/agent.json /app/researcher/agent.json
COPY researcher/scripts/ /app/scripts/

# ============================================================
# DATA — heavy scraping (browser + ffmpeg + DuckDB + Python)
# ============================================================
FROM researcher-deps AS data-deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 fonts-liberation fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*
RUN scrapling install
RUN npm install -g @duckdb/node-api
RUN pip3 install --break-system-packages duckdb

FROM data-deps AS data
COPY data/.pi/agent/ /root/.pi/agent/
COPY data/.pi/agents/ /root/.pi/agents/
COPY data/agent.json /app/data/agent.json
COPY data/scripts/ /app/scripts/
RUN touch /app/.browsers-installed

# ============================================================
# WRITER — vale linter
# ============================================================
FROM base AS writer-deps
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN curl -sfL --retry 3 --retry-delay 2 -o /tmp/vale.tar.gz \
    https://github.com/errata-ai/vale/releases/download/v3.11.2/vale_3.11.2_Linux_64-bit.tar.gz \
  && tar xzf /tmp/vale.tar.gz -C /usr/local/bin vale && rm /tmp/vale.tar.gz

FROM writer-deps AS writer
COPY writer/.pi/agent/ /root/.pi/agent/
COPY writer/.pi/agents/ /root/.pi/agents/
COPY writer/agent.json /app/writer/agent.json
COPY data/style/ /app/data/style/
