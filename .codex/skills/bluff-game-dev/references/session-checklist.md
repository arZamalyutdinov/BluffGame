# Session Checklist

## Before Coding

- Confirm whether the task changes rules, architecture, protocol, UI, or only documentation.
- Read only the relevant files in `docs/`.
- Preserve the current scope boundary: no database, no authentication, in-memory multiplayer only.

## While Changing Things

- Keep the backend authoritative for all game-state mutations.
- Prefer pure shared utilities for claim ordering, combination detection, and round resolution.
- Keep room snapshots and protocol contracts consistent with the React UI assumptions.
- If you add a new rule, document it before or alongside the code.

## Before Wrapping Up

- Re-check `docs/game-rules.md` for any rule mismatches introduced by the change.
- Re-check `docs/architecture.md` if package boundaries or state flow changed.
- Update `docs/todo.md` when a milestone is started, completed, or re-prioritized.
- Note any unresolved assumption in `docs/decisions.md` instead of burying it in implementation details.
