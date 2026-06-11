# Contributing

## Branching Model

Trunk-based development with protected master. All work on short-lived feature branches, merged via squash PR.

```
master (protected, linear history)
  ├── feat/qa-agent-pipeline        (days, not weeks)
  ├── fix/planner-routing
  ├── chore/ci-pipeline
  ├── docs/architecture-diagrams
  ├── refactor/provenance-openlineage
  └── test/e2e-migration
```

### Rules

- **No direct commits to master.** All changes via PR.
- **Squash merge only.** One commit per feature on master. PR title becomes the commit message.
- **Delete branch after merge.** No stale branches.
- **Keep branches short-lived.** Days, not weeks. If a branch grows past ~10 commits, it's too big — split it.

### Branch naming

```
feat/     — new functionality
fix/      — bug fixes
chore/    — build, deps, CI, config
docs/     — documentation only
refactor/ — code restructuring, no behavior change
test/     — test additions or migrations
```

## Commit Messages

Conventional Commits. Subject line ≤72 chars. Body only when the "why" isn't obvious from the subject.

```
feat: add QA agent quality gating to planner routing
fix: resolve planner delegating QA evaluation to publisher
chore: add GitHub Actions CI for unit and static tests
test: add jidoka and rbac unit tests (81 tests)
refactor: replace custom lineage with OpenLineage + Marquez
docs: add provenance architecture spec
```

### Scoped commits

Use parenthetical scope for changes to a specific agent or subsystem:

```
feat(qa): add evaluation skills and workproduct tools
fix(planner): move QA routing to opening section of AGENTS.md
test(e2e): fix requireAgents signature in E2E-56
chore(docker): add QA service to docker-compose
```

### Multi-author commits

When Claude Code produces the commit:

```
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## Parallel Worktree Agents

Claude Code agents work in parallel git worktrees for independent tasks. This requires discipline to avoid conflicts and keep history clean.

### How worktrees work

Each agent gets an isolated worktree branched from the current feature branch. The agent makes changes, commits, and the orchestrator merges results back.

### Best practices

**1. Disjoint file sets.** Each worktree agent MUST operate on a non-overlapping set of files. If two agents touch the same file, you get merge conflicts. Plan the partition before spawning agents.

```
Good:  Agent A edits src/agents/qa/    Agent B edits src/agents/coder/
Bad:   Agent A edits server.ts         Agent B also edits server.ts
```

**2. Never let worktree agents edit shared files.** These files are conflict magnets:
- `docker-compose.yml`
- `CLAUDE.md` / `ISSUES.md` / `MILESTONE.md`
- `src/agents/Dockerfile` (shared multi-stage)
- `tests/e2e/helpers.ts`
- `package.json` / `bun.lock`

Edit shared files in the main context after worktree agents complete.

**3. Squash worktree merges.** When merging a worktree agent's branch back, squash into one commit. The worktree's internal commit history is noise — only the final result matters.

```bash
git merge --squash worktree-agent-branch
git commit -m "feat(qa): add evaluation skills and workproduct tools"
```

**4. Short-lived worktrees.** A worktree agent should complete in one session. If it can't finish, the task is too big for a single agent — split it.

**5. Rebase before merge if needed.** If the parent branch advanced while worktree agents ran, rebase the worktree branch before merging to keep history linear.

**6. Clean up worktrees.** Remove completed worktree directories promptly. Stale worktrees accumulate and confuse tooling.

```bash
git worktree list          # see all worktrees
git worktree remove <path> # clean up completed ones
```

**7. Name worktree branches descriptively.** Not `worktree-agent-abc123` — use the task name:

```bash
git worktree add ../wt-qa-skills feat/qa-evaluation-skills
```

### Worktree + PR workflow

For a feature requiring parallel agent work:

```
1. Create feature branch:     feat/content-flywheel
2. Spawn worktree agents:     each on sub-branch (feat/content-flywheel/qa-skills, etc.)
3. Agents complete:           squash-merge each back into feat/content-flywheel
4. Edit shared files:         docker-compose, Dockerfile, helpers.ts in main context
5. Test:                      run E2E suite on the feature branch
6. PR to master:              squash merge → one commit on master
```

The master history shows one commit per feature. The feature branch history shows one commit per agent task. The worktree internal history is never visible on master.

## Pull Requests

### Title format

Same as commit message convention — the PR title becomes the squash-merge commit message.

```
feat: add content flywheel pipeline (QA, coder rendering, writer style tools)
```

### Description

```markdown
## Summary
- 1-3 bullet points of what changed and why

## Test plan
- [ ] bun test tests/unit/ (81 tests)
- [ ] bash tests/e2e/e2e-50-content-production-infra.sh (32 tests)
- [ ] bun test tests/e2e/e2e-56-qa-agent-pipeline.test.ts (6 tests, live)
```

### Review checklist

Before merging:
- [ ] Unit tests pass (`bun test tests/unit/`)
- [ ] Static E2E tests pass (e2e-50, e2e-53, e2e-55)
- [ ] Live E2E tests pass if containers affected
- [ ] No untracked files that should be committed
- [ ] Conventional commit message in PR title
- [ ] ISSUES.md updated if resolving an issue
- [ ] tasks/lessons.md updated if a correction was made

## Pre-merge Validation

Run `scripts/check.sh` before creating a PR or merging to master.

```bash
bash scripts/check.sh          # fast checks only (~10s, no containers)
bash scripts/check.sh --live   # includes live E2E tests (requires Docker)
```

Fast checks: unit tests (81) + static E2E (72). Live checks add coder rendering (15) and QA pipeline (6).

All fast checks must pass before merge. Live checks should pass when the PR touches agent code, Docker config, or extensions.
