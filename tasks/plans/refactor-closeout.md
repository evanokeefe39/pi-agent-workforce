# Refactor Close-out Plan

Branch: `refactor/provenance-openlineage`

## Task 1: Update docs for provenance removal

- [x] MILESTONE.md R1 — rewrite to reflect Marquez + provenance shipped then removed
- [x] MILESTONE.md M1.5 — note lineage system removed as part of R1
- [x] CLAUDE.md — remove 3 dead lineage test references from "Running tests"
- [x] Delete dead test files: e2e-40-lineage-service.mjs, artifact-lineage.mjs, artifact-lineage-html.mjs
- [x] Delete dead migration: scripts/migrate-001-lineage.sql
- [x] Delete dead specs/plans for lineage (artifact-lineage-graph, artifact-lineage-service)

## Task 2: Fix activeTraceId concurrency bug

- [x] Move activeTraceId + makeTraceparent from http-client.ts module scope → index.ts closure
- [x] Add optional `traceparent` param to invoke() in http-client.ts
- [x] Remove `setActiveTraceId` export from http-client.ts
- [x] Update CLAUDE.md cross-agent trace propagation section

## Task 3: E2E test migration (scoped)

- [x] Delete 3 dead lineage test files (covered by task 1)
- [x] Migrate e2e-32 (model + concurrency, 11 tests) from bash to bun:test
- [x] Migrate e2e-35 (session isolation, 11 tests) from bash to bun:test
- [x] Add generic agentRun/agentInvoke/agentPollUntilDone/dockerExec to helpers.ts
- [x] Update CLAUDE.md "Running tests" section
- [x] Remove legacy e2e-30 bash version from CLAUDE.md (TS version exists)
