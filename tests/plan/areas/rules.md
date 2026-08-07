# Rules (tag: rules)

- source: docs/use-cases-and-tests.tsv rows 136–149
- default layer: **headless** for nearly everything — rules are CRUD + inheritance logic,
  fully observable at the API. (e2e variants via ManageRulesScreen exist but headless is
  the cheap, reliable engine; do those first.) The one member-facing read (UC 229) is a
  natural e2e.
- mocks in play: none. **This whole area is unblocked** — ideal early work for cheap Writers.

Three scopes of rule, with an inheritance chain: app-wide → category → bubble. Super admin
owns app + category; bubble admin owns bubble-level + can hide inherited ones.

## UC 79 — View all app-wide rules   [todo · headless]
- roles: role-site-admin.
- positive: GET app-wide rules returns the seeded/known set; shape is correct (id, text,
  position).
- negative: a non-super-admin (role-user/bubble-admin) is denied the *manage* view (the
  read of effective rules may be public; the **admin** listing is gated — confirm which in
  routes.ts). Assert the gate.
- fixtures: rules exist only if seeded; the seed currently adds one *bubble* rule, not
  app-wide rules. **Author may need to create an app rule first** (UC 80) or note the seed
  gap in handback.

## UC 80 — Create a new app-wide rule   [todo · headless]
- roles: role-site-admin.
- positive: POST a new app rule → it appears in the list with the given text/position.
- negative: empty/blank rule text rejected; a non-super-admin POST is denied (authz) and no
  rule is created.
- fixtures: disposable (create then delete in afterAll) so the list stays deterministic.

## UC 81 — Edit an existing app-wide rule   [todo · headless]
- positive: PUT changes the text; reads back changed.
- negative: editing with empty text rejected; non-super-admin denied; rule unchanged.

## UC 82 — Delete an app-wide rule   [todo · headless]
- positive: DELETE removes it; gone from the list (and from bubbles that inherited it).
- negative: non-super-admin denied; deleting a non-existent id is a clean 404, not a 500.

## UC 83 — Reorder app-wide rules   [todo · headless]
- positive: reorder two rules; the new positions read back.
- negative: invalid position payload rejected; order unchanged.
- notes: ordering correctness (no gaps/dupes in position) is the real assertion.

## UC 84 — Assign rules to a specific category   [todo · headless]
- roles: role-site-admin.
- positive: attach a rule to a category; bubbles in that category now inherit it.
- negative: assigning to a non-existent category rejected.
- fixtures: needs a category (categories area) + a bubble in it to observe inheritance —
  mild cross-area setup.

## UC 85 — Edit or remove category-level rules   [todo · headless]
- positive: edit/remove a category rule; change reflected for that category's bubbles.
- negative: non-super-admin denied.

## UC 144 — View inherited app- and category-level rules (bubble admin)   [todo · headless]
- roles: role-bubble-admin.
- positive: a bubble's effective rules include the inherited app + category rules (not just
  its own).
- negative: rules from OTHER categories do not leak into this bubble.
- fixtures: an app rule + a category rule + a bubble in that category (cross-area setup).

## UC 145 — Hide (override) an inherited rule   [todo · headless]
- roles: role-bubble-admin.
- positive: the owner hides an inherited rule; it no longer shows in their bubble's
  effective rules, but still exists app-wide for others.
- negative: a member (non-owner) cannot hide a rule; a bubble admin cannot hide it for a
  bubble they don't own.

## UC 146 — Add a custom bubble-level rule   [todo · headless]
- roles: role-bubble-admin.
- positive: owner adds a bubble rule (like the seeded "Be kind"); it appears in that
  bubble's rules only.
- negative: empty text rejected; non-owner denied.
- fixtures: QA Test Bubble (rule-free) or a disposable bubble. (QA Rules Bubble already has
  one — good read fixture.)

## UC 147 — Edit a custom bubble-level rule   [todo · headless]
- positive/negative: as UC 81 but scoped to a bubble the actor owns; non-owner denied.

## UC 148 — Delete a custom bubble-level rule   [todo · headless]
- positive/negative: as UC 82, bubble-scoped; non-owner denied.

## UC 149 — Reorder custom rules   [todo · headless]
- positive/negative: as UC 83, bubble-scoped.

## UC 229 — View the bubble's full rules (member)   [todo · e2e]
- roles: role-user.
- positive: a member opens a bubble's rules and sees the full effective set (custom +
  inherited). QA Rules Bubble shows its one rule.
- negative: low-value; a member viewing rules rarely "fails". Consider `review`/skip the
  negative, or assert a no-rules bubble shows the empty state.

## Sequencing / dependencies

- **Inheritance UCs (84, 85, 144, 145) need a category + a bubble in it** — author them
  after at least one categories-area fixture exists, or have each create its own
  category+bubble disposably. Flag the seed gap (no app/category rules seeded today).
- The bubble-scoped CRUD (146–149) mirrors the app-scoped CRUD (80–83) almost exactly —
  the Writer can copy structure across, changing only the endpoint scope + the owner authz.

## Future work (knowingly deferred)

- e2e ManageRulesScreen variants (`tab-app-rules`, `button-add-rule`, etc.) once the
  headless logic is green.
- Effective-rule resolution correctness across all three layers at once (app+category+bubble
  with an override) — a single rich positive worth adding later.
- Seed enhancement: add 1 app rule + 1 category + 1 category rule so these tests don't each
  bootstrap their own (note for the seed.ts owner).
