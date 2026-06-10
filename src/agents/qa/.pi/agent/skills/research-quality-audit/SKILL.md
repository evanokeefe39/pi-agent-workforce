---
name: research-quality-audit
description: >
  Research quality evaluation rubric for QA agent. Covers ADMIRALTY grading compliance,
  hedging accuracy, minimum finding thresholds, source citation quality, and fraud
  signal detection (ghost followers, volume-without-quality, viral-not-saveable).
  Each rule has a unique rule_id, violation criteria, commendation criteria, and
  severity classification.
metadata:
  author: evan
  version: 1.0.0
  domain: research-quality
---

# Research Quality Audit

Evaluation rubric for assessing research output quality. Apply every rule to the
research artifacts under review. Report violations, commendations, and an overall
quality assessment.

---

## ADMIRALTY Grading Rules

### RESEARCH-ADMIRALTY-PRESENT

**rule_id:** `RESEARCH-ADMIRALTY-PRESENT`
**check:** Every finding in JSONL output must include ADMIRALTY grades (source_reliability A-F, information_credibility 1-6).
**violation:** Finding without grades.
**commendation:** All findings consistently graded.
**severity:** critical

### RESEARCH-ADMIRALTY-HEDGING

**rule_id:** `RESEARCH-ADMIRALTY-HEDGING`
**check:** Content consuming research findings must hedge according to grade:

- **A1-B2:** Cite confidently ("Analysis of 847 posts shows...", "Based on verified profile data...")
- **B3-C3:** Hedge with qualifying language ("Data suggests...", "Based on available evidence, reportedly...", "Early indicators point to...")
- **Below C3:** Exclude from audience-facing content entirely, or note explicitly ("Unverified reports indicate...")

**violation:** Confident citation of B3-C3 findings, or inclusion of sub-C3 findings without explicit caveat.
**commendation:** Hedging precisely matches grade level throughout.
**severity:** major

### RESEARCH-ADMIRALTY-DISTRIBUTION

**rule_id:** `RESEARCH-ADMIRALTY-DISTRIBUTION`
**check:** A healthy research output should have a distribution across grades, not all the same. Majority at B2-B3 expected for web research.
**violation:** All findings at same grade (suggests rubber-stamping).
**commendation:** Realistic grade distribution reflecting actual source quality.
**severity:** minor

---

## Finding Threshold Rules

### RESEARCH-MIN-FINDINGS

**rule_id:** `RESEARCH-MIN-FINDINGS`
**check:** Research output must contain at least 3 graded findings relevant to the topic. Fewer than 3 = insufficient research, should escalate for additional research rather than proceeding.
**violation:** Fewer than 3 findings.
**commendation:** 10+ well-graded findings with diverse sources.
**severity:** critical

### RESEARCH-MIN-GRADE

**rule_id:** `RESEARCH-MIN-GRADE`
**check:** All findings used in audience-facing content must be B3 or better. Sub-B3 findings may appear in raw research output but must not flow into writer content uncaveated.
**violation:** Sub-B3 finding used in audience-facing content without caveat.
**commendation:** All audience-facing findings at B2 or better.
**severity:** major

### RESEARCH-FINDING-STRUCTURE

**rule_id:** `RESEARCH-FINDING-STRUCTURE`
**check:** Each finding in JSONL must have required fields: type, claim (or finding), grade, source, context. Missing fields indicate incomplete research process.
**violation:** Finding missing required fields.
**commendation:** All findings have complete structure including optional fields (tags, entities, related_findings).
**severity:** major

---

## Source Citation Rules

### RESEARCH-SOURCE-CITATION

**rule_id:** `RESEARCH-SOURCE-CITATION`
**check:** Every factual claim must have a traceable source. Sources must include: source_name, source_url at minimum. Better sources also include: date_published, date_accessed, collection_method.
**violation:** Claim without source attribution.
**commendation:** Sources with full provenance (name, URL, dates, method).
**severity:** critical

### RESEARCH-SOURCE-DIVERSITY

**rule_id:** `RESEARCH-SOURCE-DIVERSITY`
**check:** Research should draw from multiple source types, not just one. Mix of: platform data (Apify scrapes), web articles, documentation, first-party data.
**violation:** All findings from single source.
**commendation:** 3+ distinct source types.
**severity:** minor

### RESEARCH-SOURCE-RECENCY

**rule_id:** `RESEARCH-SOURCE-RECENCY`
**check:** Sources should be recent enough to be relevant. Social media data stales fast.
**violation:** Social media metrics data older than 90 days presented as current.
**commendation:** All data within 30 days with date_accessed noted.
**severity:** major for social metrics, minor for evergreen content

---

## Fraud Signal Detection Rules

### RESEARCH-GHOST-FOLLOWERS

**rule_id:** `RESEARCH-GHOST-FOLLOWERS`
**check:** Hearts/fans ratio below 1x indicates audience not real. Healthy accounts show 5-15x hearts/fans.

Example: @theaikanteffect 10,800 fans, 577 hearts (0.05x) = fraudulent engagement.

**violation:** Account with sub-1x ratio cited as credible source without flagging the signal.
**commendation:** Fraud signal explicitly called out with ratio calculation.
**severity:** major

### RESEARCH-VOLUME-WITHOUT-QUALITY

**rule_id:** `RESEARCH-VOLUME-WITHOUT-QUALITY`
**check:** High video count with low fans/video (under 30) indicates volume without quality.

Example: @kirkstencell 1,153 videos, 9,705 fans (8 fans/video) vs @eggintech 22 videos, 14,900 fans (677 fans/video -- 85x more efficient).

**violation:** High-volume account cited as exemplar without noting efficiency.
**commendation:** Fans/video ratio calculated and noted.
**severity:** minor

### RESEARCH-VIRAL-NOT-SAVEABLE

**rule_id:** `RESEARCH-VIRAL-NOT-SAVEABLE`
**check:** High views with sub-0.5% save rate = viral but not saveable. Views are vanity; saves indicate lasting value.

Example: @michellescomputer 22.6M views, 8,354 saves (0.037%) vs @learnwithseb 941K views, 56,785 saves (6.0%) -- 7x fewer views, 7x more saves.

**violation:** Account highlighted for view count without save rate analysis.
**commendation:** Save rate calculated alongside views, used as primary quality signal.
**severity:** major

### RESEARCH-NICHE-DRIFT

**rule_id:** `RESEARCH-NICHE-DRIFT`
**check:** Post-viral niche drift causes immediate reach collapse, not gradual.

Example: @christieangelica 972K views on AI tools, then 371 views on quiz -- cliff-edge drop.

**violation:** Niche drift not flagged when detected in account analysis.
**commendation:** Drift pattern identified with before/after metrics.
**severity:** minor (detection signal, not content quality issue)

---

## Escalation Rules

### RESEARCH-ESCALATION-INSUFFICIENT

**rule_id:** `RESEARCH-ESCALATION-INSUFFICIENT`
**check:** When research produces fewer than 3 relevant findings or all findings are below B3, researcher must escalate to planner with specific request for additional research. Must NOT fabricate findings or use generic hedging to fill gaps.
**violation:** Gaps filled with ungraded or fabricated findings instead of escalation.
**commendation:** Clean escalation with specific gap description.
**severity:** critical
