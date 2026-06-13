# Area Planning Docs

One doc per functional area. This is where the **rumination** lives: for each use case,
the chosen positive angle, the chosen negative angle, which roles it applies to, what
fixtures/mocks it needs, and what is deliberately left for later. The per-unit prompts
(`units/<id>.md`) are short because they lean on the area doc named here.

**Architect-written** (expensive model). A Writer agent reads the relevant area doc but
does not edit it.

## Format (copy from `auth.md` or `events.md`)

```
# <Area> (tag: <area>)
- source: docs/use-cases-and-tests.tsv rows N–M · default layer · mocks in play
## UC <n> — <summary>   [status: done | todo | blocked:mockX | review]
- roles: <which of user/bubble-admin/site-admin, and whether to replicate>
- positive: <one blue-sky path, and the single success to assert>
- negative: <the one thing that goes wrong, and that no state changes>
- fixtures: <seeded bubble/account/event to reuse, or "disposable">
- notes / future: <2-actor? value-range variants? deferred negatives?>
## Sequencing / dependencies
## Future work (breadth gaps we are knowingly leaving)
```

Keep angles to a sentence or two. The Writer fills in selectors and assertions; the area
doc supplies intent, not code.

## Index — 13 areas

| Area | UCs | Doc | Notes |
|---|---|---|---|
| `auth` | 13 | ✅ `auth.md` | profile-edit + CCPA |
| `discovery` | 6 | ✅ `discovery.md` | browse/search/view; UI-heavy (e2e) |
| `joining` | 14 | ✅ `joining.md` | join/RSVP/leave/report; some 2-actor, some chat-mocked |
| `events` | 8 | ✅ `events.md` | create/edit/delete/RSVP/view |
| `bubble-admin` | ~37 | ✅ `bubble-admin.md` | largest (heavily deduped); own-bubble CRUD + members; share/photo mocks |
| `site-admin` | ~14 | ✅ `site-admin.md` | approve/reject pipeline, super-reach; 2-actor; dedups other areas |
| `comms` | 11 | ✅ `comms.md` | **almost all blocked on mock2-cometchat** |
| `campus` | 5 | ✅ `campus.md` | .edu verification blocked on mock1-email; prompt/dismiss unblocked |
| `notification` | 6 | ✅ `notification.md` | **all blocked on mock5-push** (in-app list slice noted) |
| `categories` | 6 | ✅ `categories.md` | super-admin hierarchy CRUD; headless; unblocked |
| `reports` | 3 | ✅ `reports.md` | waitlist + reported-concern review; 2-actor |
| `monitoring` | 9 | ✅ `monitoring.md` | super-admin dashboards/stats; headless reads |
| `rules` | 14 | ✅ `rules.md` | app/category/bubble rule CRUD + inheritance/override; headless |

All 13 area docs are drafted (breadth-first; angles are a sentence or two each, with mock
blocks and dedups called out). Deepen any area in place as it gets worked.
