# Commit Message Conventions

All commits in this repository must follow the **Conventional Commits** format.
A GitHub Actions check runs on every pull request and blocks merge if any commit
in the branch does not conform.

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

## Local setup (optional)

To catch violations before pushing, install the git hook locally:

```bash
cd mobile
npm install --save-dev @commitlint/cli @commitlint/config-conventional
# Using husky (if already set up):
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'
```

The `commitlint.config.js` at the repository root is picked up automatically by
both the local hook and the CI workflow.
