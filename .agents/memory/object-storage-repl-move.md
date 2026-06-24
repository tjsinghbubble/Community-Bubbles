---
name: Object storage breaks after repl move
description: After a repl move the app loses access to its old storage bucket; how to detect and fix, plus the relative-URL rule.
---

# Object storage breaks after a repl move

After this repl was moved, the app completely lost access to its configured
object-storage bucket. Every object request returned HTTP 500, and the
underlying error from the Replit storage sidecar was `no allowed resources`.

**Key diagnostic:** the failure is not a missing file or a 404. A direct
write+read round-trip against the bucket (`objectStorageClient.bucket(id).file(...).save()`)
fails with `no allowed resources` for BOTH read and write. `check_object_storage_status`
still reports the old bucket as "set up" (it reads env vars), so it lies — trust
the runtime round-trip, not the status tool.

**Why:** the bucket stays with the original repl; the moved repl's sidecar token
no longer grants that bucket. A telltale sign: the configured bucket id is NOT
named `repl-default-bucket-<replId>` (Replit's own naming), i.e. it came from the
previous repl.

**How to fix:**
1. Run `setup_object_storage` to provision a fresh bucket for THIS repl (updates
   `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`,
   `PUBLIC_OBJECT_SEARCH_PATHS`). Do this even though the status tool says
   "no action needed" — the runtime evidence overrides it.
2. Restart the workflow so the server picks up the new env vars; re-test the
   write+read round-trip.
3. Re-upload the image files into the new bucket under `.private/uploads/<id>`
   (no extension; the serve route maps `/objects/uploads/:id` →
   `PRIVATE_OBJECT_DIR/uploads/:id`). Set Content-Type by sniffing magic bytes —
   files have no extension and `downloadObject` serves `metadata.contentType`.
4. **Redeploy** — a live deployment published before the new bucket keeps using
   the old (inaccessible) bucket until republished.

**Store image URLs RELATIVE (`/objects/...`), never absolute.** Absolute links
(`https://<host>/objects/...`) break on every move/domain change. The mobile
`resolveMediaUrl` helper prepends `API_URL` to a leading-slash path, and web
serves relative paths against the current origin, so relative survives moves.
A prod-boot normalizer rewrites any `http(s)://<host>/objects/...` → `/objects/...`.
