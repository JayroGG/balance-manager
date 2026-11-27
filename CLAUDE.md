@AGENTS.md

## Drag-and-drop lists

Use `src/components/ui/SortableList.jsx` for any reorderable list (ADR-024): vertical-only, long-press arms the
drag (haptic + lift), spring settle + success haptic on drop, `renderItem` / `keyExtractor` / `onReorder(keys, items)` (keys are strings; map `items` back to your own ids).
Rows stay in mount order natively and move by transform only (ADR-026) — never rely on render-tree order.
It knows nothing about the data; persistence and sync live in a per-entity hook (see `useOrderedVaults`).
