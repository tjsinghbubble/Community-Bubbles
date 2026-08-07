import fs from "fs";
import path from "path";
import type { Express } from "express";
import { z } from "zod";

const APP_VERSION = process.env.npm_package_version ?? "1.0.0";
const SERVER_STARTED_AT = new Date().toISOString();

// ── Config helpers (all server-side; never sent to the client) ──────────────
function githubToken(): string | undefined {
  return process.env.GITHUB_TOKEN || undefined;
}
function githubRepo(): string | undefined {
  // "owner/repo"
  const repo = process.env.GITHUB_REPO;
  return repo && /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : undefined;
}
function expoToken(): string | undefined {
  return process.env.EXPO_TOKEN || undefined;
}

let _easProjectId: string | null | undefined;
function easProjectId(): string | null {
  if (_easProjectId !== undefined) return _easProjectId;
  try {
    const appJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "mobile/app.json"), "utf8"),
    );
    _easProjectId = (appJson?.expo?.extra?.eas?.projectId as string | undefined) ?? null;
  } catch {
    _easProjectId = null;
  }
  return _easProjectId;
}

// ── GitHub API ───────────────────────────────────────────────────────────────
async function ghFetch(pathname: string, init?: RequestInit): Promise<any> {
  const token = githubToken();
  const repo = githubRepo();
  if (!token || !repo) throw new Error("not_configured");
  const res = await fetch(`https://api.github.com/repos/${repo}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

function simplifyRun(run: any) {
  if (!run) return null;
  return {
    status: run.status as string, // queued | in_progress | completed
    conclusion: (run.conclusion ?? null) as string | null, // success | failure | cancelled | null
    branch: run.head_branch as string,
    startedAt: run.run_started_at ?? run.created_at,
    updatedAt: run.updated_at,
    url: run.html_url as string,
    title: run.display_title as string,
  };
}

async function getGithubStatus() {
  const repo = githubRepo();
  if (!githubToken() || !repo) {
    return { configured: false as const };
  }
  const [easRuns, ciRuns, latestRelease, tags] = await Promise.all([
    ghFetch(`/actions/workflows/eas-build.yml/runs?per_page=1`),
    ghFetch(`/actions/workflows/ci.yml/runs?per_page=1`),
    ghFetch(`/releases/latest`),
    ghFetch(`/tags?per_page=1`),
  ]);
  return {
    configured: true as const,
    repoUrl: `https://github.com/${repo}`,
    actionsUrl: `https://github.com/${repo}/actions`,
    latestPipelineRun: simplifyRun(easRuns?.workflow_runs?.[0]),
    latestCiRun: simplifyRun(ciRuns?.workflow_runs?.[0]),
    latestReleaseTag: latestRelease?.tag_name ?? tags?.[0]?.name ?? null,
    latestReleaseUrl: latestRelease?.html_url ?? null,
    latestReleaseAt: latestRelease?.published_at ?? null,
  };
}

// ── EAS (Expo) API ───────────────────────────────────────────────────────────
async function getEasBuilds() {
  const token = expoToken();
  const projectId = easProjectId();
  if (!token || !projectId) return { configured: false as const };

  async function latestBuild(profile: string) {
    const query = `
      query LatestBuild($appId: String!, $profile: String) {
        app { byId(appId: $appId) {
          buildsPaginated(first: 1, filter: { platforms: [IOS], buildProfile: $profile }) {
            edges { node { ... on Build {
              id status platform appVersion buildProfile createdAt completedAt
            } } }
          }
        } }
      }`;
    const res = await fetch("https://api.expo.dev/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { appId: projectId, profile } }),
    });
    if (!res.ok) throw new Error(`Expo API ${res.status}`);
    const json: any = await res.json();
    if (json.errors?.length) throw new Error(`Expo API: ${json.errors[0].message}`);
    const node = json?.data?.app?.byId?.buildsPaginated?.edges?.[0]?.node ?? null;
    if (!node) return null;
    return {
      status: node.status as string, // NEW | IN_QUEUE | IN_PROGRESS | FINISHED | ERRORED | CANCELED
      version: node.appVersion ?? null,
      profile: node.buildProfile ?? profile,
      createdAt: node.createdAt,
      completedAt: node.completedAt ?? null,
      url: `https://expo.dev/projects/${projectId}/builds/${node.id}`,
    };
  }

  const [production, staging] = await Promise.all([
    latestBuild("production"),
    latestBuild("testflight-staging"),
  ]);
  return {
    configured: true as const,
    projectUrl: `https://expo.dev/projects/${projectId}`,
    production,
    testflightStaging: staging,
  };
}

// ── Status cache (avoid hammering GitHub/Expo on 30s polling) ────────────────
const CACHE_TTL_MS = 25_000;
let statusCache: { data: any; expiresAt: number } | null = null;

async function buildStatus() {
  const settled = await Promise.allSettled([getGithubStatus(), getEasBuilds()]);
  const github =
    settled[0].status === "fulfilled"
      ? settled[0].value
      : { configured: true, error: (settled[0] as PromiseRejectedResult).reason?.message ?? "GitHub request failed" };
  const eas =
    settled[1].status === "fulfilled"
      ? settled[1].value
      : { configured: true, error: (settled[1] as PromiseRejectedResult).reason?.message ?? "Expo request failed" };
  return {
    generatedAt: new Date().toISOString(),
    web: {
      version: APP_VERSION,
      deployMode: "automatic", // Replit redeploys when main is updated (see docs/RELEASE.md)
      serverStartedAt: SERVER_STARTED_AT,
    },
    github,
    eas,
  };
}

// ── Release trigger ──────────────────────────────────────────────────────────
function bumpVersion(current: string, bump: "patch" | "minor"): string {
  const m = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`Current version '${current}' is not valid semver`);
  const [, maj, min, pat] = m;
  return bump === "minor"
    ? `${maj}.${Number(min) + 1}.0`
    : `${maj}.${min}.${Number(pat) + 1}`;
}

async function triggerIosRelease(bump: "patch" | "minor") {
  // Mirrors scripts/release.sh: bump mobile/app.json on main, then push tag vX.Y.Z.
  // The tag push triggers .github/workflows/eas-build.yml (semver gate, Sentry
  // gate, EAS build + submit) — no CI logic is duplicated here.
  const file = await ghFetch(`/contents/mobile/app.json?ref=main`);
  if (!file?.content) throw new Error("Could not read mobile/app.json from the main branch");
  const appJson = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
  const currentVersion = appJson?.expo?.version;
  const newVersion = bumpVersion(currentVersion, bump);
  const tag = `v${newVersion}`;

  // Guard: tag must not already exist
  const existingTag = await ghFetch(`/git/ref/tags/${tag}`).catch(() => null);
  if (existingTag) throw new Error(`Release ${tag} already exists — a release at this version was already started.`);

  appJson.expo.version = newVersion;
  const newContent = Buffer.from(JSON.stringify(appJson, null, 2) + "\n").toString("base64");

  const commit = await ghFetch(`/contents/mobile/app.json`, {
    method: "PUT",
    body: JSON.stringify({
      message: `chore(release): bump version to ${newVersion}`,
      content: newContent,
      sha: file.sha,
      branch: "main",
    }),
  });
  const commitSha = commit?.commit?.sha;
  if (!commitSha) throw new Error("Version bump commit failed");

  await ghFetch(`/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/tags/${tag}`, sha: commitSha }),
  });

  return { previousVersion: currentVersion, newVersion, tag, commitSha };
}

// ── Route registration ───────────────────────────────────────────────────────
type Deps = {
  storage: { getUser(id: string): Promise<any> };
  auditLog: (action: string, adminId: string, targetId: string, ip: string, extra?: Record<string, unknown>) => Promise<void>;
};

export function registerReleaseStatusRoutes(
  app: Express,
  authMiddleware: (req: any, res: any, next: any) => any,
  deps: Deps,
): void {
  async function requireSuperAdmin(req: any, res: any): Promise<boolean> {
    const user = await deps.storage.getUser(req.userId);
    if (!user?.isSuperAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
    return true;
  }

  app.get("/api/admin/release-status", authMiddleware, async (req: any, res) => {
    try {
      if (!(await requireSuperAdmin(req, res))) return;
      if (statusCache && Date.now() < statusCache.expiresAt) {
        return res.json(statusCache.data);
      }
      const data = await buildStatus();
      statusCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
      res.json(data);
    } catch (error: any) {
      console.error("[release-status]", error);
      res.status(500).json({ error: "Failed to load release status" });
    }
  });

  app.post("/api/admin/release-ios", authMiddleware, async (req: any, res) => {
    try {
      if (!(await requireSuperAdmin(req, res))) return;
      const schema = z.object({
        bump: z.enum(["patch", "minor"]),
        confirm: z.literal("RELEASE"),
      });
      const parsed = schema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request — confirmation required" });
      }
      if (!githubToken() || !githubRepo()) {
        return res.status(503).json({
          error: "Releases are not configured yet. An engineer needs to set the GITHUB_TOKEN and GITHUB_REPO secrets.",
        });
      }
      const result = await triggerIosRelease(parsed.data.bump);
      statusCache = null; // next status poll reflects the new run
      await deps.auditLog("trigger_ios_release", req.userId, result.tag, req.ip ?? "", {
        bump: parsed.data.bump,
        previousVersion: result.previousVersion,
        newVersion: result.newVersion,
      });
      res.json({
        success: true,
        tag: result.tag,
        newVersion: result.newVersion,
        message: `Release ${result.tag} started. The build pipeline is now running — this usually takes 30–60 minutes.`,
      });
    } catch (error: any) {
      const msg = error?.message === "not_configured"
        ? "Releases are not configured yet. An engineer needs to set the GITHUB_TOKEN and GITHUB_REPO secrets."
        : error?.message ?? "Failed to start release";
      console.error("[release-ios]", error);
      res.status(500).json({ error: msg });
    }
  });
}
