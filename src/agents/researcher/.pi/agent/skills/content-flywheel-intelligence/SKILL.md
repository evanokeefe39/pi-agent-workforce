---
name: content-flywheel-intelligence
description: >
  Researcher's perspective on the content flywheel. Defines research types
  that feed the flywheel, output format contracts for downstream consumers
  (Writer, Data), small-account discovery methodology, and dev-niche format
  analysis. Read when conducting research that feeds content production.
metadata:
  author: evan
  version: 1.0.0
  domain: content-strategy
---

# Content Flywheel Intelligence — Researcher Perspective

What research feeds the content flywheel and how to package findings for downstream agents.

## Research Types That Feed the Flywheel

### Competitive Intelligence
Scrape and analyze accounts in the AI/tech/dev niche. Identify what content formats, hooks, and posting patterns produce the best engagement. Output feeds Data agent for benchmarking and Planner for strategy adjustment.

### Content Format Analysis
Analyze which content formats (resource lists, demos, build journals, etc.) perform best at different follower tiers and on different platforms. Output feeds Writer for format selection and Planner for content mix decisions.

### Trend Identification
Monitor emerging topics, tools, and frameworks in the dev space. Identify what's gaining traction before it peaks. Output feeds Writer for timely content and Planner for topic scheduling.

### Source Compression
Ingest long-form content (transcripts, papers, documentation, podcast episodes) and extract the insights most relevant to a builder audience. Output feeds Writer directly for derivative content creation.

## Output Format Contract

All research output is published as JSONL dataset artifacts via `write_artifact` with type `dataset`. Each line is a self-contained finding:

```json
{"type": "finding", "finding": "text of the insight", "grade": "B2", "source": "description of source", "context": "methodology or sample size", "tags": ["tag1", "tag2"]}
```

### What Writer Needs from Researcher
- **Key points**: the 3-5 most important takeaways, graded
- **Counterintuitive insights**: findings that challenge common assumptions (highest content value)
- **Builder-relevant findings**: practical, actionable for someone building projects
- **Specific numbers**: engagement rates, follower counts, growth rates, costs — not vague ranges
- **ADMIRALTY grades**: so Writer can hedge appropriately (A1-B2 = cite confidently, B3-C3 = hedge, below C3 = exclude)

### What Data Agent Needs from Researcher
- Raw scraped datasets (JSONL/CSV) with consistent schemas
- Source quality grades per dataset
- Account-level metadata (followers, video count, join date) for normalization

## Small-Account Discovery

Methodology for finding breakout accounts in the dev niche before they're established:

### Signals That Matter
- **Follower-to-view ratio > 10x**: content reaches far beyond existing audience (breakout signal)
- **Share rate > 1%**: content valuable enough to redistribute
- **Fans/video > 100**: each piece of content converts viewers to followers efficiently

### Benchmarks (verified accounts)
- @buildwithfrancis: 28x follower-to-view ratio at 89 followers (extreme breakout)
- @startscalr.com: 10.7x at 1,062 followers (strong growth)
- @shepherdttk: 2.0% share rate (high redistribution value)

### Anti-Pattern Signals
- Hearts/fans < 1x: ghost followers, audience not real
- High volume + low fans/video (<30): posting a lot but nothing converts
- Viral single post + flat otherwise: lucky hit, not repeatable format

Vendor configuration for scraping tools: see `config/vendors.yaml`.

## Dev-Niche Format Analysis

What content formats work at <10K followers in the AI/tech/dev niche, ranked by engagement type:

| Format | Key Metric | Performance | Why It Works |
|--------|-----------|-------------|--------------|
| Opportunity sharing | 2.0% share rate | High redistribution | People share resources that help their network |
| Complete reference guides | 28x follower-to-view ratio | Massive reach | Evergreen value, algorithm favors watch time |
| Counterintuitive safety/risk framing | 1.4% share rate | Strong sharing | Challenges assumptions, triggers "others need to see this" |
| Practitioner insider analysis | High shares among advanced practitioners | Niche but deep | Expertise signals attract high-value followers |

### What Doesn't Work at Small Scale
- Generic AI tool lists without specific workflows
- Demos without hooks (jumping straight into screen recording)
- Sub-15s content with minimal caption (not enough value to save)
- News commentary without practitioner angle
