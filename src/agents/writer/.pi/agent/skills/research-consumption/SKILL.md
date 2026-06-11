---
name: research-consumption
description: >
  How Writer consumes Researcher output. ADMIRALTY grade hedging rules, JSONL
  artifact reading conventions, expected fields, and escalation protocol for
  insufficient research coverage. Read when incorporating research findings
  into any content deliverable.
metadata:
  author: evan
  version: 1.0.0
  domain: content-production
---

# Research Consumption — Writer Guidelines

How to read, interpret, and incorporate Researcher's graded findings into content.

## ADMIRALTY Grade Hedging Rules

Researcher grades every finding using the ADMIRALTY system (A-F reliability, 1-6 credibility). Writer uses these grades to determine language confidence:

### High confidence (A1-B2)
Use findings directly. Cite confidently.
- "Analysis of 847 posts shows save rates above 5% correlate with..."
- "Based on verified profile data, accounts with..."

### Medium confidence (B3-C3)
Hedge with qualifying language.
- "Data suggests that..."
- "Based on available evidence, reportedly..."
- "Early indicators point to..."

### Low confidence (below C3)
Exclude from audience-facing content, or note explicitly as unverified.
- "Unverified reports indicate..." (only if the claim is important enough to include)
- Better: omit entirely and request additional research via Planner

## Reading JSONL Artifacts

Researcher publishes findings as JSONL dataset artifacts via the artifact service. Each line is a self-contained JSON object.

### Expected fields per finding
```json
{
  "type": "finding",
  "finding": "Accounts with save rates above 5% grow followers 3.2x faster",
  "grade": "B2",
  "source": "Apify scrape of 31 TikTok accounts, June 2026",
  "context": "Based on 858 posts, statistically significant (p=0.0075)",
  "tags": ["save-rate", "growth", "benchmark"]
}
```

### How to use
1. Read the artifact via `read_artifact`
2. Filter findings by relevance to the current content task
3. Sort by grade (highest confidence first)
4. Apply hedging rules based on grade
5. Cite the source field when making specific claims

## Escalation Protocol

If Researcher's findings are insufficient for the content task:

1. Do NOT fabricate data or make unsupported claims
2. Do NOT use generic hedging to paper over missing research ("some experts say...")
3. DO escalate to Planner with a specific request: what additional research is needed, what quality bar it must meet, and which findings are missing
4. Planner will re-delegate to Researcher with refined requirements

Insufficient coverage means: fewer than 3 graded findings relevant to the content topic, or all findings below B3 confidence.
