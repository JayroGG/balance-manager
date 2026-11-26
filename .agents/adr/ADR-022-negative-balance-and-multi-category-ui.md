# ADR-022 — Negative balance display and multi-category transactions

- **Status:** Accepted — supersedes in part ADR-009 (client cap: available never negative)
- **Date:** 2026-11-26

## Context
BE ADR-012 allows `available < 0`; BE ADR-013 makes categories a list.

## Decision
- Remove client caps that blocked expenses above available; keep allocate/lend caps.
- Negative money renders in the theme danger color from one shared place (MoneyText-level), not per screen.
- Transaction form category chips are multi-select (`category_ids`); list rows show every category;
  the list's category filter stays single-select.

- Implementation: `MoneyText` takes an opt-in `signed` prop (negative → `colors.danger`); passed for available/total/net figures and the vault/loan "available" hints. The dashboard hero swaps the accent surface for the card surface while `available < 0` so the red stays legible on any team accent.
- Writes send `category_ids: int[]` (the old `category_id` is rejected by the BE); rows read `categories: [{ id, name }]`. Shopping-list checkout keeps its single default category and sends `category_ids: [id]`.

## Consequences
- Per-category totals can sum to more than the overall total (the full amount counts under each tag); editing sends `category_ids: []` to clear all tags.
- Chips expose `checkbox` role/state; allocate/lend show an "exceeds available" hint instead of a silent disabled button.
- Users can record overspending; red figures make it visible without blocking.
