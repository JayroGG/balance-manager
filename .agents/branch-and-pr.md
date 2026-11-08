# Branch flow & PR ritual

## Branch flow

1. Feature branch (`feat/...`) → PR into **`development`**, merged as a **merge commit** — the integration/testing line (manual validation happens here).
2. Once tested and ready for stage: **rebase the local feature branch on `main`**, then open a PR to **`main`** merged as a **squash** — main/stage carries exactly one commit per feature.
3. Consequence: `development` and `main` histories diverge by design — never merge `main` back into `development` expecting git to dedupe features.

When finishing a feature, hand Jayro TWO messages when relevant: the PR body for the `development` merge, and a squash-commit message (subject + full-feature body, `(#PR)` suffix) for the eventual `main` PR.

## End-of-flow ritual (always)

1. Work on a **feature branch**.
2. Sync docs (`.agents/adr/`, `ARCHITECTURE.md`, `AGENTS.md`).
3. Conventional commits.
4. Push.
5. Hand Jayro a **PR title + body inside a markdown code block** to copy-paste (merge happens via GitHub PR).
6. Write the same PR body to **`PR_MESSAGE.md`** at the project root (gitignored — it stays a local, uncommitted scratch file) and print it in the chat too.

## PR format

- **Title:** formal and scoped — `feat(scope): … (ADR-NNN)`, citing the ADR when the work sits under one.
- **Body** starts with `### Summary` (1–2 sentences), then per-change `###` sections, then `### Testing` and `### Notes`.
- Mention any ADR the change relates to, even if no new ADR was written.

## Gitignored artifacts

`.gitignore` ignores `PR_MESSAGE.md` and the `.claude/` working dir. The `.agents/adr/` and `.agents/plans/` directories are tracked — new ADRs/plans are force-added if needed.
