# Branching Strategy

```mermaid
flowchart TD
    DEV(["👩‍💻 Developer"])

    DEV -->|"git checkout -b feat/my-feature"| FB

    subgraph FEATURE["Feature Branches  —  short-lived"]
        FB["feat/* · fix/* · chore/*\n─────────────────────\nOne task per branch\nDeleted after merge"]
    end

    subgraph STAGING_ENV["staging  —  integration & QA"]
        STG["staging branch\n─────────────────────\n• All features merge here first\n• Server auto-deploys to Replit staging\n• Preview EAS builds (QR codes) on every PR\n• CI tests run here"]
    end

    subgraph MAIN_ENV["main  —  production-ready only"]
        MAIN["main branch\n─────────────────────\n• Protected: PRs required\n• No direct pushes\n• Always deployable"]
    end

    subgraph HOTFIX_ENV["Hotfixes  —  bypass staging"]
        HF["hotfix/* branch\n─────────────────────\nBranch from main\nPR directly to main\nBackport PR to staging"]
    end

    subgraph RELEASE["Release"]
        TAG["git tag v1.2.3\n─────────────────────\n↓ triggers automatically\n• EAS prod build\n• App Store + Play Store submit\n• GitHub Release + CHANGELOG"]
    end

    FB -->|"PR → staging\n(code review + CI)"| STG
    STG -->|"validated on staging\nPR → main"| MAIN
    MAIN -->|"git tag v1.2.3\ngit push origin v1.2.3"| TAG

    DEV -->|"critical bug in prod"| HF
    HF -->|"PR → main"| MAIN
    HF -->|"backport PR"| STG

    style FEATURE fill:#e8f0fe,stroke:#4285f4,color:#000
    style STAGING_ENV fill:#fef9e7,stroke:#f4b400,color:#000
    style MAIN_ENV fill:#e6f4ea,stroke:#34a853,color:#000
    style HOTFIX_ENV fill:#fce8e6,stroke:#ea4335,color:#000
    style RELEASE fill:#f3e8fd,stroke:#9334e6,color:#000
    style DEV fill:#f8f9fa,stroke:#666,color:#000
```

---

## Branch Lifecycle

```mermaid
sequenceDiagram
    participant D as 👩‍💻 Dev
    participant F as feat/my-feature
    participant S as staging
    participant M as main
    participant CI as 🤖 GitHub Actions

    D->>F: git checkout -b feat/my-feature
    D->>F: commits (pre-commit hooks run)
    D->>S: open Pull Request
    CI-->>S: ✅ commit lint
    CI-->>S: ✅ PR title lint
    CI-->>S: ✅ run tests (Vitest + Jest)
    CI-->>S: ✅ EAS preview build → QR codes posted
    D->>D: smoke test on physical device
    D->>S: code review approved → Merge
    CI-->>S: ✅ server deploys to Replit staging
    D->>D: validate on staging environment
    D->>M: open PR staging → main
    D->>M: merge (after review)
    D->>M: git tag v1.2.3 && git push origin v1.2.3
    CI-->>M: ✅ Sentry crash-free rate check
    CI-->>M: ✅ EAS production build
    CI-->>M: ✅ App Store + Play Store submit
    CI-->>M: ✅ GitHub Release created
```

---

## Hotfix Lifecycle

```mermaid
sequenceDiagram
    participant D as 👩‍💻 Dev
    participant H as hotfix/critical-bug
    participant M as main
    participant S as staging
    participant CI as 🤖 GitHub Actions

    D->>M: git checkout main
    D->>H: git checkout -b hotfix/critical-bug
    D->>H: minimal focused fix
    D->>M: open PR hotfix → main
    D->>M: merge (fast review)
    D->>M: git tag v1.2.1
    CI-->>M: ✅ production build + submit
    D->>S: open backport PR hotfix → staging
    D->>S: merge (keep staging in sync)
```

---

## Naming Conventions

| Branch | Pattern | Example |
|---|---|---|
| Feature | `feat/<short-description>` | `feat/event-share-links` |
| Bug fix | `fix/<short-description>` | `fix/member-count-race` |
| Chore / infra | `chore/<short-description>` | `chore/add-ci-workflow` |
| Hotfix | `hotfix/<short-description>` | `hotfix/null-event-crash` |
| Release tag | `v<major>.<minor>.<patch>` | `v1.2.3` |

Commit messages must follow **Conventional Commits** (enforced by Husky):
```
feat: add event share deep links
fix: atomic member count increment
chore: untrack .env file
```
