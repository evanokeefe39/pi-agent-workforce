# Agents

## Planner

**Port:** 8081 | **Max turns:** unlimited | **Concurrency:** 1

The orchestrator. Receives high-level goals, decomposes them into tasks, delegates to specialist agents, assesses quality of results, and iterates. Does not perform work directly — it delegates everything via `subagent-http`.

**Key tools:** `subagent` (list, invoke, parallel tasks)
**Extensions:** subagent-http, artifacts, tool-policy, context-compaction

The planner has access to the artifact service for reading results but not to research, writing, or coding tools. This enforces the delegation pattern.

---

## Researcher

**Port:** 8082 | **Max turns:** 60 | **Concurrency:** 3

Web research specialist. Searches the web, scrapes pages, and produces structured findings graded with ADMIRALTY reliability/credibility scores (A-F reliability, 1-6 credibility).

**Key tools:** `web_search`, `web_fetch`, `scrape_apify`, `deep_research`, `record_finding`, `publish_artifact`
**Extensions:** artifacts, deep-research, web-scrape, workproduct, context-compaction
**Required tools:** `record_finding`, `publish_artifact`

Output: JSONL dataset of structured findings, each with ADMIRALTY grades and source attribution.

---

## Data

**Port:** 8083 | **Max turns:** 50 | **Concurrency:** 2 | **Memory:** 2 GB

Data analysis specialist. Scrapes structured data, runs SQL analytics via DuckDB, and produces metrics, charts, and dataset references.

**Key tools:** `web_search`, `web_fetch`, `scrape_apify`, `record_query_result`, `record_metric`, `record_chart`, `record_dataset_ref`, `publish_artifact`
**Extensions:** artifacts, duckdb, web-scrape, workproduct, context-compaction
**System deps:** Python 3, Scrapling, Playwright (Chromium), ffmpeg, DuckDB

---

## Writer

**Port:** 8084 | **Max turns:** 50 | **Concurrency:** 2 | **Memory:** 1 GB

Document generation specialist. Consumes research findings, produces long-form documents with proper hedging based on ADMIRALTY grades. Uses a section fanout pattern — plans sections, writes each via subagent, then assembles.

**Key tools:** `read_artifact`, `publish_artifact`, `validate_style`, `fix_violations`, `vale_lint`
**Extensions:** artifacts, writing-style, workproduct, context-compaction
**System deps:** Vale linter

---

## Publisher

**Port:** 8085 | **Max turns:** 30 | **Concurrency:** 2

Content distribution specialist. Receives completed content, assembles it according to platform requirements, runs a pre-publish checklist, stages for review, publishes with HITL (human-in-the-loop) gating.

**Key tools:** `read_artifact`, `publish_artifact`
**Extensions:** artifacts, tool-policy
**Skills:** brand-guidelines, platform-formats

---

## Coder

**Port:** 8086 | **Max turns:** 40 | **Concurrency:** 2 | **Memory:** 4 GB

Code execution and visual rendering specialist. Writes JSX components using a design system, renders them to high-resolution images via headless Chromium. Used for social media graphics, data visualizations, and branded content.

**Key tools:** `bash`, `write`, `read`, `publish_artifact`
**Extensions:** artifacts, tool-policy
**Skills:** brand-guidelines, platform-formats
**System deps:** Chromium, React, ReactDOM, Tailwind CSS, esbuild, Playwright

---

## QA

**Port:** 8087 | **Max turns:** 30 | **Concurrency:** 2

Quality assurance specialist. Reviews content against brand guidelines, platform requirements, and quality criteria. Produces structured verdicts with pass/fail per criterion.

**Key tools:** `read_artifact`, `publish_artifact`
**Extensions:** artifacts, tool-policy
**Skills:** brand-guidelines, platform-formats, content-calendar
