---
unit_id: $unit_id
area: $area
kind: $kind
uc: $uc
layer: $layer
roles: $roles
output_path: $output_path
needs_mock: $needs_mock
status: claimed
claimed_at: $claimed_at
---

# Test-Creation Assignment — $unit_id

You are a test-writing agent for the Bubble app. Write exactly ONE test and stop.
First read `tests/plan/CONTEXT.md` (shared ground truth) and the area planning doc
`tests/plan/areas/$area.md` (the ruminated angle for this use case). Do not explore
beyond what those point you to.

## The use case

- **UC $uc:** $uc_summary
- **Acting role(s):** $roles
- **Functional area:** $area

## Your job: the **$kind** test

$kind_instructions

## Constraints

- **Engine:** `$layer`. Write the file at exactly: `$output_path`
- Copy the nearest sibling test in that directory as your structural template (same
  imports, same login/guard boilerplate). Change only what THIS use case requires.
- Use the tag block below **verbatim** (fill in the `qa-reason` one-liner only).
- $mock_line

## Tags — apply verbatim

```
$tag_block
```

Leave `unverified` in place; the Reviewer removes it after one green run. Do not add or
drop other tags. (If you DID run this test green yourself — possible for headless — say so
in the handback and the Reviewer drops `unverified` immediately.)

## Acceptance criteria

- [ ] File exists at `$output_path`, named per the output-naming rule.
- [ ] It targets UC $uc for role(s) $roles and only that.
- [ ] A $kind outcome is asserted (CONTEXT.md §8). For negatives, assert BOTH the
      refusal AND that no state changed.
- [ ] `qa-id`, `qa-reason`, and tags are present.
- [ ] You did not invent a selector or endpoint; anything unconfirmed is flagged.

## Handback

Follow CONTEXT.md §9. Propose the one-line `tests/TAXONOMY.md` registry row for this
unit so a human can ratify the reserved id.

When finished, the human (or orchestrator) marks this unit done:
`python3 scripts/testplan.py done $unit_id`
