---
name: shell-quote deploy firewall block
description: Why deploy builds fail at npm install on shell-quote, and the override fix
---

# Deploy npm install blocked on shell-quote

Replit's supply-chain firewall (Socket Security) blocks `shell-quote@1.8.3` with a "Critical CVE" during the deployment build's `npm install` step, returning HTTP 403 from `package-firewall.replit.local`. The dev workflow uses already-installed `node_modules`, so this only surfaces at publish time, not in dev.

**Fix:** pin `"shell-quote": "1.8.4"` in the `overrides` block of BOTH root `package.json` and `mobile/package.json`, and bump the version in BOTH lockfiles (`package-lock.json`, `mobile/package-lock.json`). 1.8.4 is the allowed (latest) version; only 1.8.3 is flagged.

**Why:** `shell-quote` is a transitive dep (spec `^1.6.1`) pulled by multiple packages; it resolves to the blocked 1.8.3 without an override.

**How to apply:** Do NOT run a full `npm install --package-lock-only` to regenerate the lockfile here — it re-resolves the whole tree and hits an unrelated 404 on `@tailwindcss/oxide-wasm32-wasi` (an optional wasm tarball the firewall doesn't proxy). Instead edit the `shell-quote` version field surgically in each lockfile (these entries carry no integrity hash, so npm fetches at install). Then `npm run build` to confirm.
