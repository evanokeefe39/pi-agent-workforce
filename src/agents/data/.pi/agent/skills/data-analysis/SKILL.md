---
name: data-analysis
description: >
  DuckDB SQL patterns, statistical summary defaults, social media metric
  definitions, analysis task templates, and output format conventions for
  code-first data analysis. Use when analyzing datasets from researcher
  artifacts, computing engagement metrics, producing statistical summaries,
  or generating structured datasets for downstream agents.
metadata:
  author: evan
  version: 1.0.0
  domain: data-analysis
---

# Data Analysis for Social Media / Creator Metrics

Domain knowledge for analyzing scraped social media data. Metric formulas,
default statistical summaries, task templates, output conventions, and anti-patterns.

## Metric Definitions

Standard formulas for social media engagement analysis. Always compute these
from raw data — never estimate.

| Metric | Formula | Unit | Notes |
|--------|---------|------|-------|
| save_rate | saves / views * 100 | % | Primary quality signal. Elite: 5%+, good: 3-5%, avg: 1.5-3% |
| engagement_rate | (likes + saves + comments) / views * 100 | % | Overall engagement efficiency |
| likes_per_post | total_likes / post_count | count | Content resonance per unit |
| followers_per_post | followers / post_count | count | Growth efficiency |
| hearts_per_fan | total_hearts / followers | ratio | Audience quality. <1x = ghost followers (AP1) |
| growth_rate | new_followers / days_active | count/day | New acct: avg 20-50, good 50-200, elite 200+ |
| fans_per_video | followers / video_count | count | Content-to-growth conversion. <30 = volume without quality (AP2) |

## Default Statistical Summary

When you receive any dataset, compute this profile first (DISCOVER phase):

```sql
-- One-liner for full column profile
SUMMARIZE SELECT * FROM read_csv('/path/to/data.csv');

-- Manual equivalent with quantiles
SELECT
  COUNT(*) AS row_count,
  COUNT(*) FILTER (WHERE col IS NULL) AS null_count,
  COUNT(DISTINCT col) AS distinct_count,
  MIN(col), MAX(col),
  AVG(col)::DECIMAL(10,2) AS mean,
  MEDIAN(col) AS median,
  QUANTILE_CONT(col, 0.25) AS p25,
  QUANTILE_CONT(col, 0.75) AS p75
FROM data;
```

For categorical columns, compute top-5 values by frequency:
```sql
SELECT col, COUNT(*) AS n FROM data GROUP BY col ORDER BY n DESC LIMIT 5;
```

## Analysis Task Templates

### Competitor analysis
1. Ingest profile data (CSV/JSONL from researcher Apify scrape)
2. Compute per-account metrics (save_rate, engagement_rate, likes_per_post, hearts_per_fan)
3. Rank accounts by primary metric (save_rate for quality, growth_rate for trajectory)
4. Identify outliers: accounts >2σ above/below mean on any metric
5. Flag anti-patterns: AP1 (hearts_per_fan < 1), AP2 (fans_per_video < 30)
6. Produce ranked comparison table + summary KPIs

### Trend analysis
1. Ingest time-series data (posts with timestamps)
2. Compute rolling averages (7-day, 30-day windows)
3. Detect inflection points: where rolling avg changes direction by >20%
4. Compute period-over-period deltas (week-over-week, month-over-month)
5. Produce trend lines + change-point annotations

### Content performance
1. Ingest post-level data with content type classifications
2. Compute per-type aggregates (avg save_rate, avg engagement, post count per type)
3. Rank content formats by primary metric
4. Identify format-metric interactions (e.g., listicles save better, demos engage more)
5. Produce per-type summary + cross-type comparison table

### Cross-source comparison
1. Ingest N datasets from different sources or time periods
2. Normalize schemas (align column names, types, units)
3. Join on common key (account name, content ID)
4. Compute differentials between sources (absolute diff, % change)
5. Flag discrepancies >10% between sources
6. Produce reconciliation table

## Output Format Conventions

JSONL dataset artifacts — one JSON object per line, each line self-contained.

**Metric line:**
```json
{"type":"metric","metric":"save_rate","value":1.35,"unit":"%","entity":"eggintech","window":"2026-06","confidence":"high","source_query":"01JHX..."}
```

**Summary line:**
```json
{"type":"summary","dimension":"content_type","measures":{"avg_save_rate":3.2,"avg_engagement":5.1,"post_count":45},"window":"2026-06"}
```

**Comparison line:**
```json
{"type":"comparison","entity":"eggintech","metrics":{"save_rate":1.35,"engagement_rate":5.06,"likes_per_post":2045},"rank":3,"flags":["high_volume_low_saves"]}
```

Writer expects structured fields it can reference — not raw SQL output or markdown tables.

## Anti-Patterns

- **AP1: Estimating when you can compute.** "Approximately 50%" when exact count is `SELECT COUNT(*)` away. Always compute.
- **AP2: Markdown tables as final output.** Always `record_query_result` + `write_artifact`. Markdown is for human notes, not deliverables.
- **AP3: Orphan computation.** Running `duckdb_query` but not calling `record_query_result`. Every meaningful query gets recorded.
- **AP4: Skipping DISCOVER phase.** Querying before understanding schema leads to wrong column names, type mismatches, and wasted turns.
- **AP5: Single mega-query.** One 50-line SQL that does everything. Decompose into steps: each step produces one `record_query_result`, is independently validatable, and can be replanned if results are unexpected.

For DuckDB SQL patterns, read `{baseDir}/references/duckdb-cookbook.md`.
For validation checks, read `{baseDir}/references/validation-checklist.md`.
