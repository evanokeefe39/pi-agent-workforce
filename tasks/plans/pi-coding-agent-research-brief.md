# Research Brief: Optimal Pi Agent Interactive Coding Setup

Status: READY FOR REVIEW — pending human approval before handoff to researcher/planner

## Objective

Compile a comprehensive catalog of Pi agent coding configurations, extensions, packages, skills, and community repos that represent the current best-in-class interactive coding experience. Output is a ranked recommendation list the user can evaluate and selectively adopt.

## Background

We run a multi-agent workforce (pi-agent-workforce) with 5 specialist agents orchestrated via pi-subagents-http. The **coder agent** exists as a workforce subagent today. We now want to also build an **interactive Pi coding agent** for daily general-purpose coding across all repos.

Current state:
- Pi SDK: @earendil-works/pi-coding-agent v0.79.0
- Basic interactive setup exists but is minimal/default
- Workforce coder has: pi-otel, pi-tasks, pi-subagents, pi-permission-system, custom extensions (artifacts, workproduct, web-search, web-fetch, deep-research, duckdb, writing-style, session-plan)
- Model routing: DeepSeek V4 Flash primary, V4 Pro for plan/review, Groq Llama 8B for small tasks, multi-provider fallback chains

Known community projects to investigate:
- **oh-my-pi** — referenced but not evaluated
- **shitty-extensions** — referenced but not evaluated

## Research Scope

### Priority Areas (all four, equal weight)

1. **Extension ecosystem** — community extensions, MCP server integrations, tool packs. What extensions do power users run? What MCP servers are commonly wired in?

2. **Model routing** — best config.yml patterns for model selection, fallback chains, provider strategies. Which models pair best with Pi for coding tasks? Cost vs quality tradeoffs at scale.

3. **Context management** — memory systems, compaction strategies, session persistence, large codebase handling. How do power users manage context in long coding sessions?

4. **Interactive UX** — status line configs, widgets, keybindings, terminal customization, startup optimization. What makes the interactive experience smooth?

### Artifact Types to Collect

- GitHub repos containing .pi/ configurations (especially .pi/agent/ dirs)
- Published npm packages in the Pi ecosystem (@earendil-works/*, community packages)
- Extension source code (standalone .ts files, directory-based extensions)
- Skill definitions (SKILL.md files with domain knowledge)
- config.yml examples with model routing patterns
- settings.json examples with interactive UX tuning
- Blog posts, YouTube videos, Reddit/Discord threads discussing Pi agent setups
- Claude Code skill repos (SKILL.md patterns adaptable to Pi)

### Sources to Search

1. **GitHub** — repos with .pi/ directories, repos referencing pi-coding-agent, extension repos, config dotfile repos. Use star count as quality signal — skip repos with zero stars.
2. **npm** — packages depending on or extending @earendil-works/pi-coding-agent or @mariozechner/pi-coding-agent
3. **YouTube** — primary video source. Many Pi agent creators post setup walkthroughs, extension reviews, config tours. Search for Pi agent coding setup, Pi extensions, Pi config, oh-my-pi demos.
4. **Social media** — Instagram and TikTok for short-form Pi agent content. X/Twitter threads. Reddit r/PiAgent or similar. HackerNews discussions.
5. **Claude Code skills** — Claude Code has a skills ecosystem (SKILL.md files) for coding workflows. Many patterns are directly adaptable to Pi agent skills. Search for popular Claude Code skill repos and evaluate portability.
6. **Community channels** — Pi Discord (if exists), forums, documentation sites
7. **Pi SDK examples** — node_modules/@earendil-works/pi-coding-agent/examples/extensions/ contains 100+ example extensions

### Specific Questions to Answer

1. What extensions does oh-my-pi bundle and what's the install experience?
2. What does shitty-extensions contain and is any of it useful?
3. What are the top 10 most-used community extensions by GitHub stars/usage?
4. What MCP servers do Pi coding agent users commonly integrate?
5. What model routing patterns produce the best coding results? (speed vs quality vs cost). NOTE: model recommendations change rapidly — capture what people use NOW but flag that this data has a short shelf life. Our experience: DeepSeek V4 Pro underperforms despite community hype (ignored structured output, caused timeouts). Treat all model claims skeptically.
6. How do power users handle context compaction for large codebases?
7. Are there Pi "starter kits" or "dotfile" repos that bundle a complete interactive setup?
8. What Pi packages beyond the standard set (pi-tasks, pi-otel, pi-subagents) add value for interactive coding?
9. What keybinding/shortcut configurations improve interactive workflow?
10. What skills (SKILL.md) do coding-focused agents typically include?

## Output Format

Deliver as structured JSONL (one finding per line) using researcher workproduct format with ADMIRALTY grades. Each finding should include:

```json
{
  "type": "extension|package|skill|config|repo|discussion",
  "name": "human-readable name",
  "source_url": "github/npm/social URL",
  "category": "extension-ecosystem|model-routing|context-management|interactive-ux",
  "description": "what it does, 1-3 sentences",
  "relevance": "why it matters for our setup",
  "reliability": "A-F ADMIRALTY grade",
  "credibility": "1-6 ADMIRALTY grade",
  "install_method": "npm|git clone|copy config|manual",
  "dependencies": ["list of deps if known"],
  "notes": "any caveats, conflicts, or open questions"
}
```

Additionally produce a summary ranking:
- Top 5 extensions to adopt immediately
- Top 3 model routing patterns to test
- Top 3 context management strategies
- Top 3 UX improvements
- Repos worth forking/studying in detail

### Additional Questions

11. What Claude Code skills for coding workflows could be adapted to Pi agent skills?
12. What YouTube creators consistently cover Pi agent setups and configs?
13. What Pi SDK version is current stable (not experimental/beta)? Should we upgrade from v0.79.0?

## Constraints

- Do NOT install or run anything — research only
- Do NOT modify any existing agent configs
- Prioritize actively maintained projects (commits in last 6 months)
- **Minimum quality bar: skip repos/extensions with zero GitHub stars** — use stars as rough popularity signal
- Flag any extensions that require specific Pi SDK versions
- Note licensing for all repos (we need MIT/Apache2 compatible)
- SDK upgrades: recommend stable releases only, not experimental/beta versions
- Model recommendations: capture current state but flag as perishable data

## Deliverables

1. JSONL findings file (structured, machine-readable)
2. Summary markdown with ranked recommendations
3. Gap analysis: what's missing from the ecosystem that we'd need to build ourselves

## Timeline

Single research session. Deep-research extension available if needed for thorough web crawling.
