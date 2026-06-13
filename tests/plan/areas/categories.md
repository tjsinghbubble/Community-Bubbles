# Categories (tag: categories)

- source: docs/use-cases-and-tests.tsv rows 118–123
- default layer: **headless** (super-admin hierarchy CRUD; fully API-observable). e2e
  variants exist but do headless first.
- mocks in play: none — fully unblocked. Good early cheap-Writer work.

Super-admin-only. A parent/subcategory tree. Every negative has the same authz half
(non-super-admin denied) plus a validation half.

## UC 89 — View the full category hierarchy   [todo · headless]
- positive: GET the hierarchy → parents with nested subcategories, correct shape.
- negative: non-super-admin denied the admin view (confirm whether read is public vs gated
  in routes.ts; assert the gate that exists).
- fixtures: needs categories to exist; seed has none guaranteed → create one first (UC 90)
  or note the seed gap.

## UC 90 — Create a new parent category   [todo · headless]
- positive: POST a parent category → appears in the hierarchy at top level.
- negative: empty/duplicate name rejected; non-super-admin denied; nothing created.
- fixtures: disposable (delete in afterAll) to keep the tree deterministic.

## UC 91 — Create a subcategory under a parent   [todo · headless]
- positive: POST a child under an existing parent → nested correctly under it.
- negative: creating under a non-existent parent rejected; non-super-admin denied.
- fixtures: create a disposable parent first, then the child.

## UC 92 — Edit a category name or icon   [todo · headless]
- positive: PUT changes name/icon; reads back changed.
- negative: empty name rejected; non-super-admin denied; unchanged.

## UC 93 — Delete a category   [todo · headless]
- positive: DELETE removes it (and decide/observe what happens to its subcategories +
  bubbles in it — assert the documented behavior, e.g. cascade or block-if-nonempty).
- negative: deleting a non-existent id is a clean 404; non-super-admin denied; deleting a
  non-empty category behaves per spec (likely blocked) — assert it.

## UC 94 — Reorder categories   [todo · headless]
- positive: reorder two categories; new positions read back.
- negative: invalid position payload rejected; order unchanged.

## Sequencing / dependencies
- 91–94 depend on a parent existing → each test creates its own disposable parent, or a
  small shared `beforeAll` creates one. Categories also underpin rules UCs 84/144 — a
  seeded category would help both areas (note for seed.ts owner).

## Future work (knowingly deferred)
- e2e variants via the category-management UI. Deep trees (multi-level nesting) and
  move-subtree operations — future. Bubble-recategorization side effects — future.
