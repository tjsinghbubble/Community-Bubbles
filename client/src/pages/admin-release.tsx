import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  XCircle,
  CheckCircle2,
  Clock,
  Rocket,
  Globe,
  Smartphone,
  FlaskConical,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface AuthMe {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
}

interface RunInfo {
  status: string;
  conclusion: string | null;
  branch: string;
  startedAt: string;
  updatedAt: string;
  url: string;
  title: string;
}

interface EasBuildInfo {
  status: string;
  version: string | null;
  profile: string;
  createdAt: string;
  completedAt: string | null;
  url: string;
}

interface ReleaseStatus {
  generatedAt: string;
  web: { version: string; deployMode: string; serverStartedAt: string };
  github: {
    configured: boolean;
    error?: string;
    repoUrl?: string;
    actionsUrl?: string;
    latestPipelineRun?: RunInfo | null;
    latestCiRun?: RunInfo | null;
    latestReleaseTag?: string | null;
    latestReleaseUrl?: string | null;
    latestReleaseAt?: string | null;
  };
  eas: {
    configured: boolean;
    error?: string;
    projectUrl?: string;
    production?: EasBuildInfo | null;
    testflightStaging?: EasBuildInfo | null;
  };
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Tone = "good" | "bad" | "busy" | "muted";

function runTone(run: RunInfo | null | undefined): Tone {
  if (!run) return "muted";
  if (run.status !== "completed") return "busy";
  return run.conclusion === "success" ? "good" : "bad";
}

function runLabel(run: RunInfo | null | undefined): string {
  if (!run) return "No runs yet";
  if (run.status === "queued") return "Waiting to start";
  if (run.status !== "completed") return "Running now";
  if (run.conclusion === "success") return "Succeeded";
  if (run.conclusion === "cancelled") return "Cancelled";
  return "Failed";
}

function easTone(b: EasBuildInfo | null | undefined): Tone {
  if (!b) return "muted";
  if (b.status === "FINISHED") return "good";
  if (b.status === "ERRORED" || b.status === "CANCELED") return "bad";
  return "busy";
}

function easLabel(b: EasBuildInfo | null | undefined): string {
  if (!b) return "No builds yet";
  switch (b.status) {
    case "FINISHED": return "Build succeeded";
    case "ERRORED": return "Build failed";
    case "CANCELED": return "Build cancelled";
    case "NEW":
    case "IN_QUEUE": return "Waiting in queue";
    default: return "Building now";
  }
}

function StatusPill({ tone, label, testId }: { tone: Tone; label: string; testId: string }) {
  const styles: Record<Tone, string> = {
    good: "bg-emerald-100 text-emerald-700",
    bad: "bg-red-100 text-red-700",
    busy: "bg-amber-100 text-amber-700",
    muted: "bg-black/8 text-muted-foreground",
  };
  const Icon = tone === "good" ? CheckCircle2 : tone === "bad" ? XCircle : tone === "busy" ? Clock : AlertTriangle;
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", styles[tone])}
      data-testid={testId}
    >
      <Icon className={cn("h-3 w-3", tone === "busy" && "animate-pulse")} />
      {label}
    </span>
  );
}

function ExtLink({ href, label, testId }: { href: string; label: string; testId: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#35A8F7] hover:underline"
      data-testid={testId}
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function NotConfigured({ what, secrets }: { what: string; secrets: string }) {
  return (
    <div className="rounded-xl bg-amber-50 px-4 py-3 text-[12px] text-amber-800 ring-1 ring-amber-200">
      {what} status is not connected yet. An engineer needs to add the {secrets} secret
      {secrets.includes(" ") ? "s" : ""} in Replit → Tools → Secrets. Once added, this card fills in automatically.
    </div>
  );
}

function ApiError({ what, detail }: { what: string; detail?: string }) {
  return (
    <div className="rounded-xl bg-red-50 px-4 py-3 text-[12px] text-red-700 ring-1 ring-red-200">
      Could not reach {what} right now — this is usually temporary. It will retry automatically.
      {detail && <div className="mt-1 break-all text-[10px] text-red-500">{detail}</div>}
    </div>
  );
}

export default function AdminRelease() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [bump, setBump] = useState<"patch" | "minor">("patch");
  const [releaseMessage, setReleaseMessage] = useState<string | null>(null);

  const { data: me, isLoading: meLoading } = useQuery<AuthMe>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
    retry: false,
  });

  const { data, isLoading, isFetching, isError, refetch } = useQuery<ReleaseStatus>({
    queryKey: ["/api/admin/release-status"],
    queryFn: () => apiRequest("GET", "/api/admin/release-status").then((r) => r.json()),
    enabled: !!user && me?.isSuperAdmin === true,
    refetchInterval: 30_000,
  });

  const releaseMutation = useMutation({
    mutationFn: (body: { bump: "patch" | "minor"; confirm: "RELEASE" }) =>
      apiRequest("POST", "/api/admin/release-ios", body).then((r) => r.json()),
    onSuccess: (result) => {
      setShowConfirm(false);
      setReleaseMessage(result.message ?? "Release started.");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/release-status"] });
    },
  });

  useEffect(() => {
    if (!user && !meLoading) {
      navigate("/profile");
      return;
    }
    if (me && !me.isSuperAdmin) {
      navigate("/profile");
    }
  }, [user, me, meLoading, navigate]);

  if (!user || meLoading) return null;
  if (me && !me.isSuperAdmin) return null;

  const gh = data?.github;
  const eas = data?.eas;
  const pipelineBusy = gh?.latestPipelineRun && gh.latestPipelineRun.status !== "completed";

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-6 md:pb-8">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => navigate("/admin/monitor")}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/6 text-muted-foreground transition hover:bg-black/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-[22px] font-bold tracking-tight">Release Status</h1>
            <p className="text-[12px] text-muted-foreground">
              What's live, what's building, and one-click iOS releases
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-white transition disabled:opacity-60"
            style={{ background: "#35A8F7" }}
            data-testid="button-refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>

        {releaseMessage && (
          <div
            className="mb-4 flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800 ring-1 ring-emerald-200"
            data-testid="text-release-started"
          >
            <Rocket className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{releaseMessage}</span>
            <button
              onClick={() => setReleaseMessage(null)}
              className="ml-auto text-emerald-600 hover:text-emerald-800"
              data-testid="button-dismiss-release-message"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#35A8F7]" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/70 py-16 text-center ring-1 ring-black/8" data-testid="release-status-error">
            <XCircle className="h-8 w-8 text-red-400" />
            <div className="text-[14px] font-semibold text-red-600">Failed to load release status</div>
            <button
              onClick={() => refetch()}
              className="mt-1 rounded-xl px-4 py-2 text-[12px] font-semibold text-white"
              style={{ background: "#35A8F7" }}
              data-testid="button-retry"
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* ── Web ── */}
            <div className="rounded-2xl bg-white/70 p-5 ring-1 ring-black/8" data-testid="card-web-status">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Globe className="h-4 w-4 text-[#35A8F7]" />
                <span className="flex-1 text-[14px] font-bold">Website</span>
                <StatusPill tone="good" label="Live" testId="pill-web-status" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Live version</div>
                  <div className="text-[16px] font-bold" data-testid="text-web-version">v{data.web.version}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Running since</div>
                  <div className="text-[13px] font-semibold" data-testid="text-web-started">{fmtDateTime(data.web.serverStartedAt)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">How it deploys</div>
                  <div className="text-[12px] text-muted-foreground">
                    Deploys automatically whenever changes land on the main branch — no button needed.
                  </div>
                </div>
              </div>
            </div>

            {/* ── iOS ── */}
            <div className="rounded-2xl bg-white/70 p-5 ring-1 ring-black/8" data-testid="card-ios-status">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Smartphone className="h-4 w-4 text-[#35A8F7]" />
                <span className="flex-1 text-[14px] font-bold">iOS App</span>
                {gh?.configured && !gh.error && (
                  <StatusPill
                    tone={runTone(gh.latestPipelineRun)}
                    label={`Release pipeline: ${runLabel(gh.latestPipelineRun)}`}
                    testId="pill-pipeline-status"
                  />
                )}
              </div>

              {!gh?.configured ? (
                <NotConfigured what="GitHub" secrets="GITHUB_TOKEN and GITHUB_REPO" />
              ) : gh.error ? (
                <ApiError what="GitHub" detail={gh.error} />
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Latest release</div>
                      <div className="text-[16px] font-bold" data-testid="text-latest-release-tag">
                        {gh.latestReleaseTag ?? "None yet"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {gh.latestReleaseAt ? `Published ${fmtDateTime(gh.latestReleaseAt)}` : ""}
                        {gh.latestReleaseUrl && (
                          <span className="ml-2"><ExtLink href={gh.latestReleaseUrl} label="View" testId="link-latest-release" /></span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Latest pipeline run</div>
                      {gh.latestPipelineRun ? (
                        <div className="text-[12px]" data-testid="text-pipeline-run">
                          <span className="font-semibold">{gh.latestPipelineRun.title}</span>
                          <span className="text-muted-foreground"> — {fmtDateTime(gh.latestPipelineRun.startedAt)}</span>
                          {gh.latestPipelineRun.status === "completed" && gh.latestPipelineRun.conclusion !== "success" && (
                            <div className="mt-1 text-[11px] text-red-600">
                              The last release attempt did not finish successfully. An engineer should check the details.
                            </div>
                          )}
                          <div className="mt-0.5">
                            <ExtLink href={gh.latestPipelineRun.url} label="Details on GitHub" testId="link-pipeline-run" />
                          </div>
                        </div>
                      ) : (
                        <div className="text-[12px] text-muted-foreground">No release pipeline has run yet.</div>
                      )}
                    </div>
                  </div>

                  {/* EAS builds */}
                  {!eas?.configured ? (
                    <NotConfigured what="App build (Expo)" secrets="EXPO_TOKEN" />
                  ) : eas.error ? (
                    <ApiError what="Expo" detail={eas.error} />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { key: "production", label: "App Store build", build: eas.production },
                        { key: "staging", label: "TestFlight (staging) build", build: eas.testflightStaging },
                      ].map(({ key, label, build }) => (
                        <div key={key} className="rounded-xl bg-black/3 px-4 py-3" data-testid={`eas-build-${key}`}>
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
                            <StatusPill tone={easTone(build)} label={easLabel(build)} testId={`pill-eas-${key}`} />
                          </div>
                          {build ? (
                            <div className="text-[12px] text-muted-foreground">
                              {build.version ? `Version ${build.version} · ` : ""}
                              {fmtDateTime(build.completedAt ?? build.createdAt)}
                              <span className="ml-2"><ExtLink href={build.url} label="View" testId={`link-eas-${key}`} /></span>
                            </div>
                          ) : (
                            <div className="text-[12px] text-muted-foreground">No builds found for this profile.</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Release trigger */}
                  <div className="flex flex-wrap items-center gap-3 border-t border-black/5 pt-4">
                    <button
                      onClick={() => setShowConfirm(true)}
                      disabled={!!pipelineBusy}
                      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white transition disabled:opacity-50"
                      style={{ background: "#35A8F7" }}
                      data-testid="button-start-release"
                    >
                      <Rocket className="h-4 w-4" />
                      Start iOS release
                    </button>
                    <span className="text-[11px] text-muted-foreground">
                      {pipelineBusy
                        ? "A release is already running — wait for it to finish."
                        : "Builds the app and sends it to Apple. After the build, review happens in App Store Connect."}
                    </span>
                    {gh.actionsUrl && (
                      <span className="ml-auto"><ExtLink href={gh.actionsUrl} label="All pipeline runs" testId="link-actions" /></span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Tests ── */}
            <div className="rounded-2xl bg-white/70 p-5 ring-1 ring-black/8" data-testid="card-tests-status">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <FlaskConical className="h-4 w-4 text-[#35A8F7]" />
                <span className="flex-1 text-[14px] font-bold">Test Health</span>
                {gh?.configured && !gh.error && (
                  <StatusPill tone={runTone(gh.latestCiRun)} label={runLabel(gh.latestCiRun)} testId="pill-ci-status" />
                )}
              </div>
              {!gh?.configured ? (
                <NotConfigured what="GitHub" secrets="GITHUB_TOKEN and GITHUB_REPO" />
              ) : gh.error ? (
                <ApiError what="GitHub" detail={gh.error} />
              ) : gh.latestCiRun ? (
                <div className="text-[12px] text-muted-foreground" data-testid="text-ci-run">
                  Latest test run on <span className="font-semibold text-foreground">{gh.latestCiRun.branch}</span>
                  {" — "}{gh.latestCiRun.title} · {fmtDateTime(gh.latestCiRun.startedAt)}
                  <span className="ml-2"><ExtLink href={gh.latestCiRun.url} label="Details" testId="link-ci-run" /></span>
                  {gh.latestCiRun.status === "completed" && gh.latestCiRun.conclusion !== "success" && (
                    <div className="mt-1 text-[11px] text-red-600">
                      Tests are failing — hold off on releasing until an engineer takes a look.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-muted-foreground">No test runs found yet.</div>
              )}
            </div>

            <div className="text-center text-[10px] text-muted-foreground" data-testid="text-generated-at">
              Auto-refreshes every 30 seconds · Last updated {fmtDateTime(data.generatedAt)}
            </div>
          </div>
        ) : null}

        {/* Confirm release dialog */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" data-testid="dialog-confirm-release">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#35A8F7]/10">
                <Rocket className="h-6 w-6 text-[#35A8F7]" />
              </div>
              <h2 className="text-[17px] font-bold" data-testid="text-confirm-release-title">Start an iOS release?</h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                This bumps the app version and starts the full build pipeline (safety checks, build, upload to Apple).
                It usually takes 30–60 minutes and cannot be undone once started.
              </p>
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Release size</div>
                <div className="flex gap-2">
                  {([
                    { value: "patch", label: "Small fix", hint: "e.g. 1.9.2 → 1.9.3" },
                    { value: "minor", label: "New features", hint: "e.g. 1.9.2 → 1.10.0" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setBump(opt.value)}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2.5 text-left transition",
                        bump === opt.value ? "border-[#35A8F7] bg-[#35A8F7]/8" : "border-black/10 hover:bg-black/5",
                      )}
                      data-testid={`button-bump-${opt.value}`}
                    >
                      <div className="text-[13px] font-bold">{opt.label}</div>
                      <div className="text-[10px] text-muted-foreground">{opt.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              {releaseMutation.isError && (
                <p className="mt-3 text-[12px] font-semibold text-red-600" data-testid="text-release-error">
                  {(releaseMutation.error as any)?.message?.replace(/^\d+:\s*/, "") || "Could not start the release. Please try again."}
                </p>
              )}
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-[13px] font-semibold transition hover:bg-black/5"
                  data-testid="button-cancel-release"
                >
                  Cancel
                </button>
                <button
                  onClick={() => releaseMutation.mutate({ bump, confirm: "RELEASE" })}
                  disabled={releaseMutation.isPending}
                  className="flex-1 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white transition disabled:opacity-60"
                  style={{ background: "#35A8F7" }}
                  data-testid="button-confirm-release"
                >
                  {releaseMutation.isPending ? "Starting…" : "Start release"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
