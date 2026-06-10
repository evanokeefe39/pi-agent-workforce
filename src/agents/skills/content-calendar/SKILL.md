---
name: content-calendar
description: >
  Shared content calendar for the flywheel. Defines weekly cadence template,
  growth phase adjustments, fallback content matrix, and calendar artifact
  format. Planner reads for scheduling decisions. Writer creates and updates
  calendar artifacts. Publisher reads for publish timing and can edit for
  last-minute changes.
metadata:
  author: evan
  version: 1.0.0
  domain: content-strategy
---

# Content Calendar — Shared Skill

Weekly cadence, scheduling conventions, and calendar artifact format used across the agent team.

## Weekly Cadence Template

| Day | Deliverable | Producer | Distributor |
|-----|-------------|----------|-------------|
| Sunday | Anchor recording outline + 2 clip ideas + X thread | Writer | — |
| Monday | Clip A → TikTok + Reels. X thread post. LinkedIn post. | — | Publisher |
| Tuesday | Build update clip (phone, 30 min) → TikTok | — | Publisher |
| Wednesday | Clip B → TikTok + Reels. LinkedIn post. | — | Publisher |
| Thursday | Tool tip or build update → TikTok | — | Publisher |
| Friday | Full anchor → YouTube. LinkedIn post. | — | Publisher |
| Saturday | Analytics review. Schedule reposts of top performers. | Data | Publisher |

Sunday is production day (Writer creates). Monday-Friday is distribution (Publisher posts). Saturday is feedback (Data analyzes, Publisher schedules recycled content).

## Growth Phase Adjustments

### Weeks 1-4: Find Format
- Lighter cadence: 5 posts/week instead of 7
- Skip LinkedIn until voice is established
- Focus on TikTok + Instagram only
- Goal: test 3+ formats, identify what hits >1.5% save rate

### Weeks 5-8: Build Chain
- Full cadence as above
- Add LinkedIn (repurpose analytical content from anchor)
- Establish consistent anchor → derivative workflow
- Goal: weekly production chain running smoothly

### Weeks 9-12: Scale
- Add recycling slots (Saturday repost scheduling)
- Multi-account strategy if any post hit 50K+ views
- Introduce lead magnet / DM automation content
- Goal: self-sustaining flywheel with data-driven adjustments

## Fallback Content Matrix

When the weekly cadence breaks down (no anchor recorded, Writer blocked, etc.), Planner uses this to decide what to produce instead. This is decision-making context, not execution instructions.

| Situation | Fallback | Producer |
|-----------|----------|----------|
| No anchor recorded this week | Recycle top performer from 6+ months ago | Publisher |
| Writer blocked on research | Build diary from current project status | Writer (standalone) |
| No new research available | Deep post building blocks from existing anchor content | Writer |
| Platform metrics declining | Analytics-driven format pivot — Data produces report, Planner replans | Data → Planner |
| All agents available, no specific task | Competitive intelligence cycle — research what's working for others | Researcher → Data |

## Calendar Artifact Format

The content calendar is stored as an artifact in the artifact service. Format:

```json
{
  "type": "content-calendar",
  "week_of": "2026-06-15",
  "phase": "weeks-5-8",
  "slots": [
    {
      "day": "sunday",
      "deliverable": "Anchor outline: 5 Claude Code features replacing 3 tools",
      "producer": "writer",
      "status": "planned",
      "dependencies": ["research-findings-artifact-id"]
    },
    {
      "day": "monday",
      "deliverable": "Clip A: TikTok + Reels + X thread + LinkedIn",
      "distributor": "publisher",
      "status": "planned",
      "content_refs": ["anchor-outline-artifact-id"]
    }
  ],
  "notes": "Format test week — trying numbered_promise hooks on all platforms"
}
```

### Reading the calendar
- Planner: check `week_of` and `phase` to inform task decomposition. Check `status` to know what's done vs pending.
- Writer: read `slots` to know what to produce. Update `status` as deliverables are completed.
- Publisher: read `slots` to know what to distribute and when. Can edit `status` and add `published_url` after posting.
