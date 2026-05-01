# Commit Message Conventions

All commits in this repository must follow the **Conventional Commits** format.
Two GitHub Actions checks run on every pull request and both must pass before
merge is allowed:

1. **PR title check** — validates the pull request title itself, because GitHub's
   "Squash and merge" strategy uses the PR title as the final commit message.
2. **Commit message check** — validates every individual commit on the branch.

---

## Format

```
<type>(<optional scope>): <short description>

[optional body]

[optional footer(s)]
```

### Examples

```
feat(auth): add phone number verification step
fix(bulletin): prevent duplicate post submissions
chore: update expo SDK to 52
refactor(profile): extract avatar upload into shared hook
docs: add commit conventions guide
test(notifications): add unit tests for badge count logic
```

---

## Allowed types

| Type       | When to use                                              |
|------------|----------------------------------------------------------|
| `feat`     | A new feature visible to users                           |
| `fix`      | A bug fix                                                |
| `chore`    | Maintenance tasks, dependency updates, tooling           |
| `refactor` | Code change that neither fixes a bug nor adds a feature  |
| `docs`     | Documentation only changes                               |
| `test`     | Adding or updating tests                                 |
| `perf`     | A code change that improves performance                  |
| `ci`       | Changes to CI/CD configuration files and scripts         |
| `build`    | Changes that affect the build system or external deps    |
| `revert`   | Reverts a previous commit                                |
| `style`    | Formatting, whitespace — no logic change                 |

---

## Rules

- **type** is required and must be lowercase.
- **description** is required and must not end with a period.
- **header** (first line) must not exceed 100 characters.
- Merge commits and commits matching `[skip ci]` are ignored by the changelog
  generator — use `[skip ci]` only for automated bot commits.

---

## PR title requirement

Because this repository uses **Squash and merge**, GitHub uses the PR title as
the squashed commit message that lands on the default branch. The PR title must
therefore also follow the conventional commit format above.

The workflow `.github/workflows/pr-title-lint.yml` (powered by
`amannn/action-semantic-pull-request`) runs automatically on every
`pull_request_target` event and posts a required status check called
**"Validate PR title (conventional commit)"**.

### Bypassing for bots / automated PRs

Apply the `bot` or `ignore-semantic-pr` label to a pull request to skip the
title check. Only use this for fully automated PRs (e.g. Dependabot, release
bots) that cannot follow the conventional format.

---

## Branch protection (required status checks)

Branch protection is configured automatically by
`.github/workflows/setup-branch-protection.yml`. The workflow runs whenever
that file is updated on `main`, or on demand via **Actions → Setup Branch
Protection → Run workflow**.

The following status checks are enforced as **required** on `main`:

| Status check name                          | Workflow file             |
|--------------------------------------------|---------------------------|
| `Validate PR title (conventional commit)`  | `pr-title-lint.yml`       |
| `Lint commit messages`                     | `pr-commitlint.yml`       |

With these checks required, GitHub blocks the merge button until both pass —
even for repository administrators.

### One-time secret setup

The setup workflow needs an admin-scoped Personal Access Token to modify branch
protection rules (the default `GITHUB_TOKEN` does not have that permission).

1. Create a PAT at **GitHub → Settings → Developer settings → Personal access
   tokens** with the `repo` scope (classic token) or `administration: write`
   permission (fine-grained token).
2. Add it to the repository as a secret named **`ADMIN_PAT`** under
   **Settings → Secrets and variables → Actions**.
3. Trigger the workflow once via **Actions → Setup Branch Protection → Run
   workflow** to apply the rules, or push a change to the workflow file itself.

After the initial run the settings persist in GitHub and the workflow keeps
them in sync on every subsequent update.

---

## Local setup

Two git hooks are included via **husky** and activate automatically after
`npm install`:

| Hook | File | Purpose |
|------|------|---------|
| `pre-commit` | `.husky/pre-commit` | Runs `tsc --noEmit` when TypeScript files are staged |
| `commit-msg` | `.husky/commit-msg` | Validates the commit message format with commitlint |

### First-time setup (run once after cloning)

```bash
# From the repository root
npm install
```

`npm install` triggers the `prepare` script which initialises husky and
activates both hooks automatically. No additional steps are required.

### How it works

#### Pre-commit TypeScript check

- Runs **before** the commit is recorded.
- Inspects the staged file list (`git diff --cached`).
- If any `.ts` or `.tsx` files are staged **outside** `mobile/`, it runs
  `tsc --noEmit` from the repository root.
- If any `.ts` or `.tsx` files are staged **inside** `mobile/`, it runs
  `tsc --noEmit` from the `mobile/` directory.
- Commits that contain **no TypeScript files** (docs, images, configs, etc.)
  skip the check entirely, so there is no unnecessary delay.
- If type errors are found, the commit is **rejected immediately** with the
  compiler output shown inline.

#### Commit-message check

- The hook lives at `.husky/commit-msg`.
- It calls `commitlint --edit` against the message you wrote.
- The rules come from `commitlint.config.js` at the repository root, which is
  the same file used by the CI workflow.
- If your message violates the rules, the commit is **rejected immediately**
  with a clear error explaining what went wrong.

### Verifying the hooks are active

```bash
git config --get core.hooksPath   # should show .husky
ls .husky/pre-commit              # file should exist
ls .husky/commit-msg              # file should exist
```

### Bypassing (not recommended)

If you need to skip both hooks in an emergency:

```bash
git commit --no-verify -m "your message"
```

Use this sparingly — the CI check will still block non-conforming commits on
pull requests, and type errors will surface during the build.
