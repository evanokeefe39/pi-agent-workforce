# Writer Reference: Formats, Formulas, and Style Cloning

Archived from AGENTS.md during fanout pipeline rewrite. These features are available
via the writing-style extension tools (get_style_instructions handles platform and
formula injection automatically) but are documented here for reference.

## Platform Formats

When `platform` is in the task payload, pass it to `get_style_instructions` which
returns platform-specific constraints.

**Twitter/X.** 280 char max per tweet. Threads numbered (1/N), open with most important
point. Punchy declarative sentences. No em dashes. One idea per tweet.

**LinkedIn.** Hook opener (single short sentence/question). Short paragraphs (1-3
sentences). Professional but conversational. Close with CTA or question. 3000 char limit.

**Blog.** H2/H3 every 200-400 words. 800-2000 words. Front-load value. One idea per
paragraph. Conclusion advances, does not recap.

**Whitepaper.** Formal with citations. Abstract, executive summary, TOC required.
3000-10000 words. Claim → evidence → implication structure.

**Email.** Front-load ask in first two sentences. Subject under 50 chars. One CTA near
end. No filler openers.

## Copy Formulas

When `copy_formula` is in the task payload, pass it to `get_style_instructions` which
returns the formula structure.

**AIDA** — Attention → Interest → Desire → Action
**PAS** — Problem → Agitate → Solution
**BAB** — Before → After → Bridge
**FAB** — Features → Advantages → Benefits
**4Ps** — Promise → Picture → Proof → Push

For long-form documents, the formula governs intro and conclusion only. For short-form
(social, email, ad copy), it governs the whole piece.

## Style Cloning

When `analyze_writing_samples` is the action in the task payload, run the style analysis
pipeline instead of document generation:

1. Call `analyze_writing_samples` with the samples directory path
2. The tool extracts vocabulary fingerprint, sentence rhythm, structural patterns, tone markers
3. Output the resulting profile to `style-profile.json`, publish via `publish_artifact`
4. Include the profile path and a plain-language voice summary (3-5 sentences) in the response

This action is mutually exclusive with document generation.

## Workproduct Types

The writer has these workproduct tools (self-documenting via tool descriptions):
- `record_report` — long-form with executive summary, recommendations, confidence level
- `record_guide` — how-to with prerequisites, steps, difficulty, outcome
- `record_article` — editorial with angle, platform, tone, SEO keywords
- `record_marketing_copy` — promotional with CTA, variants, platform constraints
- `record_newsletter` — issue with cadence, sections, featured items
- `query_content` / `get_content` — search and retrieve recorded content
