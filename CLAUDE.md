# CLAUDE.md

## Project
Lifeline is a static web app for the Global Energy Hackathon 2026 (Anneru Solutions, Oct 30 – Nov 1, 2026). It sizes solar, battery and inverter for Nigerian hospitals (keeping the existing diesel generator as backup), simulates an outage day that keeps life-critical loads powered, and shows the Energy-as-a-Service finance case. The approved spec is `docs/superpowers/specs/2026-10-30-lifeline-design.md` (tracked in git).

**Deadline first.** The demo path must always work and be deployed: Home → "Simulate an outage" → Outage day plays → Plan → Download proposal.

## Project documents (tracked in git)
Read the ones relevant to your task before changing code.
- `PLAN.md`: implementation tasks in build order, with tests for each.
- `DESIGN.md`: visual design, screens, components, interface text.
- `HANDOFF.md`: context for resuming after compaction or a session limit (idea-phase context, model numbers and their sources). Update after each completed task and before compaction.

## Stack and commands
- Locked stack: Vite (react-ts), React, TypeScript strict, Recharts, Vitest, jsdom, @testing-library/react and jest-dom. Hosting is Vercel. The only runtime dependencies are `react`, `react-dom`, `recharts`, `motion` (import from `motion/react`) and `lucide-react` (import named icons only). No router or state library.
- Commands: `npm run dev`, `npm test`, `npm run lint`, `npm run build` (the build also type-checks). On Windows, use Git Bash or PowerShell syntax as the tool requires.

## Project rules
- `src/engine/` is pure TypeScript with no React or DOM imports. All simulation and finance rules live there, with unit tests.
- Life-critical (T1) load is never shed. Never weaken the tests that check that T1 is never shed or that energy balances.
- Interface text comes from DESIGN.md §8. Every default number needs an entry in `src/data/sources.ts`, and number values come from HANDOFF.md.
- The UI says "life-critical", "essential" and "can wait". It never shows T1, T2 or T3.

## No AI attribution
- Do not mention Claude, Anthropic, or AI assistance anywhere in the repository, except in the project docs (`CLAUDE.md`, `PLAN.md`, `DESIGN.md`, `HANDOFF.md`).
- This covers code, comments, README, config, and test files.
- Commit messages and PR descriptions must not mention Claude or AI. Do not add `Co-Authored-By`, `Generated with`, or similar trailers or footers.
- Do not add Claude, or any bot, as an author, committer, or contributor.
- Write commit messages as plain descriptions of the change.

## Working rules
1. **Plan first.** Read PLAN.md, restate the task, and outline the approach before editing. Small, obvious fixes can skip the outline.
2. **Lock the stack.** Use the approved stack and existing libraries. Ask before adding or replacing a dependency.
3. **Stay in your lane.** Change only what was requested. No unrelated refactors, renames, or cleanup.

## Codebase exploration (skip for trivial single-file changes)
Tools: `codebase-memory-mcp` (current structure, call paths, impact) and `claude-mem` (past decisions, fixes, failed approaches).
1. Identify the repo: `list_projects`, `index_status`; refresh if stale.
2. Recall history: `claude-mem` `search` (3–5 results) → `timeline` → `get_observations` (batch IDs). `get_tool_uses` is a last resort. Multi-session work: start with `work_state_read`.
3. Map the code: `search_graph`, `get_file_outline`, `get_code_snippet`, `trace_path`.
4. Verify in source. Memory and graph results are leads; source code is the truth.
5. Make the smallest correct change; keep earlier architectural decisions unless justified.
6. Save progress with `work_state_write`.

If a tool is unavailable, fall back to file search and say so. Never fabricate memories, tool calls, graph results, or index status. When reporting, say whether a finding came from memory, the graph, or verified source.

## Code quality
- Write for the next maintainer: simple, explicit, conventional. Follow existing architecture, naming, and formatter/linter.
- Small, focused functions with descriptive names. No speculative features, needless abstractions, or new dependencies without clear value.
- Handle errors explicitly. Never swallow exceptions, use `any`, disable type checks, or suppress lint rules to silence errors.
- Preserve backward compatibility unless told otherwise.
- Comments explain *why* (business rules, trade-offs), not *what*.

## Verification
- Add or update tests for changed behavior and edge cases. Never weaken tests to make them pass.
- Run tests, lint, and type checks. Don't claim a check passed unless you ran it.
- Review the final diff for unrelated changes, security issues, and secrets.

## Completion report
1. What changed and why. 
2. Files modified. 
3. Checks run and actual results. 
4. Remaining risks. 
5. Remaining tasks.