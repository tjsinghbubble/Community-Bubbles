import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  RefreshCw,
  Database,
  Server,
  Users,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Loader2,
  Activity,
  TrendingUp,
  School,
  MessageSquare,
  HardDrive,
  Cpu,
  Globe,
  Ghost,
  BarChart2,
  Shield,
  Wrench,
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
  profilePhoto: string | null;
}

interface PingResult {
  status: "ok" | "error" | "unconfigured";
  latencyMs: number | null;
  error: string | null;
}

interface AdminStats {
  db: { status: "connected" | "error"; error: string | null };
  server: {
    uptimeSeconds: number;
    nodeVersion: string;
    environment: string;
    memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number };
  };
  integrations: { cometChat: PingResult; objectStorage: PingResult };
  stats: {
    users: { total: number | null; new7d: number | null; new30d: number | null };
    bubbles: {
      total: number | null;
      approved: number | null;
      pending: number | null;
      rejected: number | null;
      new7d: number | null;
      new30d: number | null;
      orphan: number | null;
      avgMembers: number | null;
    };
    events: {
      total: number | null;
      approved: number | null;
      pending: number | null;
      thisMonth: number | null;
      upcoming: number | null;
    };
    memberships: { total: number | null };
    campuses: {
      total: number | null;
      verifiedUsers: number | null;
      campusBubbles: number | null;
    };
    pendingReview: { bubbles: number; events: number; waitlist: number; reports: number };
  };
  fetchedAt: string;
}

interface AnalyticsMetrics {
  retention: { day1: number; day7: number; day30: number };
  dauMau: { dau: number; mau: number; stickiness: number };
  sessionLength: { averageSeconds: number };
  sessionsPerUser: { daily: number; weekly: number };
  overview: { totalUsers: number; totalBubbles: number; totalEvents: number; totalSessions: number };
  bubbleVisits: { topBubbles: { bubbleId: string; title: string; visits: number }[]; totalVisits: number };
}

interface AuditLogEntry {
  id: string;
  action: string;
  adminId: string;
  targetId: string;
  ip: string | null;
  extra: string | null;
  createdAt: string;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h < 24) return `${h}h ${mins}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const secs = Math.round(s % 60);
  return `${m}m ${secs}s`;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white/70 p-5 ring-1 ring-black/8" data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div
          className="grid h-9 w-9 place-items-center rounded-xl"
          style={{ background: `${accent ?? "#35A8F7"}18` }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: accent ?? "#35A8F7" }} />
        </div>
      </div>
      <div>
        <div className="text-[28px] font-bold leading-none tracking-tight" data-testid={`stat-value-${label.toLowerCase().replace(/\s+/g, "-")}`}>
          {value}
        </div>
        {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function MiniStatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-4 ring-1 ring-black/8">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: accent ?? "#35A8F7" }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="text-[22px] font-bold leading-none tracking-tight">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PendingRow({
  label,
  count,
  icon: Icon,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  onClick: () => void;
}) {
  const hasItems = count > 0;
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-black/5"
      data-testid={`pending-row-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-[13px] font-semibold">{label}</span>
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
          hasItems ? "bg-amber-100 text-amber-700" : "bg-black/6 text-muted-foreground"
        )}
        data-testid={`pending-count-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {count}
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-bold">{value}</span>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5" data-testid={`info-row-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" style={accent ? { color: accent } : undefined} />
      <span className="flex-1 text-[13px] font-semibold">{label}</span>
      <div className="text-[12px] font-medium text-muted-foreground">{value}</div>
    </div>
  );
}

function IntegrationRow({ label, result, icon: Icon }: { label: string; result: PingResult; icon: React.ElementType }) {
  const isOk = result.status === "ok";
  const isUnconfigured = result.status === "unconfigured";
  return (
    <div className="flex items-center gap-3 px-5 py-4" data-testid={`integration-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div
        className="grid h-9 w-9 place-items-center rounded-xl"
        style={{ background: isOk ? "#10B98118" : isUnconfigured ? "#94a3b818" : "#E8453C18" }}
      >
        <Icon className="h-4 w-4" style={{ color: isOk ? "#10B981" : isUnconfigured ? "#94a3b8" : "#E8453C" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold">{label}</div>
        {result.error && !isUnconfigured && (
          <div className="truncate text-[11px] text-red-500">{result.error}</div>
        )}
        {isUnconfigured && (
          <div className="text-[11px] text-muted-foreground">Not configured</div>
        )}
        {isOk && result.latencyMs !== null && (
          <div className="text-[11px] text-muted-foreground">{result.latencyMs}ms</div>
        )}
      </div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold",
          isOk ? "bg-emerald-100 text-emerald-700"
            : isUnconfigured ? "bg-black/6 text-muted-foreground"
            : "bg-red-100 text-red-600"
        )}
      >
        {isOk
          ? <><CheckCircle2 className="h-3.5 w-3.5" /> Reachable</>
          : isUnconfigured
          ? <>— Not set</>
          : <><XCircle className="h-3.5 w-3.5" /> Unreachable</>}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function actionLabel(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminMonitor() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showConfirmEnable, setShowConfirmEnable] = useState(false);

  const { data: me, isLoading: meLoading, isError: meError } = useQuery<AuthMe>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
    retry: false,
  });

  const {
    data: stats,
    isLoading: statsLoading,
    isFetching,
    isError: statsError,
    refetch,
  } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => apiRequest("GET", "/api/admin/stats").then((r) => r.json()),
    enabled: !!user && me?.isSuperAdmin === true,
    refetchInterval: 30_000,
  });

  const { data: analyticsData } = useQuery<AnalyticsMetrics>({
    queryKey: ["/api/analytics/metrics"],
    queryFn: () => apiRequest("GET", "/api/analytics/metrics").then((r) => r.json()),
    enabled: !!user && me?.isSuperAdmin === true,
    refetchInterval: 60_000,
  });

  const { data: auditData } = useQuery<{ logs: AuditLogEntry[] }>({
    queryKey: ["/api/admin/audit-logs"],
    queryFn: () => apiRequest("GET", "/api/admin/audit-logs?limit=20").then((r) => r.json()),
    enabled: !!user && me?.isSuperAdmin === true,
    refetchInterval: 30_000,
  });

  const {
    data: maintenanceData,
    isLoading: maintenanceLoading,
    isError: maintenanceError,
  } = useQuery<{ maintenance_mode: boolean }>({
    queryKey: ["/api/admin/maintenance-mode"],
    queryFn: () => apiRequest("GET", "/api/admin/maintenance-mode").then((r) => r.json()),
    enabled: !!user && me?.isSuperAdmin === true,
    refetchInterval: 30_000,
  });

  const maintenanceMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("PATCH", "/api/admin/maintenance-mode", { enabled }).then((r) => r.json()),
    onMutate: async (enabled: boolean) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/maintenance-mode"] });
      const previous = queryClient.getQueryData(["/api/admin/maintenance-mode"]);
      queryClient.setQueryData(["/api/admin/maintenance-mode"], { maintenance_mode: enabled });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["/api/admin/maintenance-mode"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/maintenance-mode"] });
    },
  });

  function handleMaintenanceToggle(desiredState: boolean) {
    if (desiredState) {
      setShowConfirmEnable(true);
    } else {
      maintenanceMutation.mutate(false);
    }
  }

  function confirmEnableMaintenance() {
    setShowConfirmEnable(false);
    maintenanceMutation.mutate(true);
  }

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

  if (meError) {
    return (
      <AppShell active="profile">
        <div className="mx-auto w-full max-w-2xl px-4 pt-20 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-400" />
          <div className="mt-3 text-[15px] font-semibold text-red-600">Could not verify permissions</div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Unable to confirm super-admin access. Please refresh or try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white"
            style={{ background: "#35A8F7" }}
            data-testid="button-retry-auth"
          >
            Refresh
          </button>
        </div>
      </AppShell>
    );
  }

  const dbOk = stats?.db?.status === "connected";
  const uptime = stats?.server?.uptimeSeconds ?? 0;
  const s = stats?.stats;
  const mem = stats?.server?.memory;
  const lastFetched = stats?.fetchedAt ? formatTime(stats.fetchedAt) : null;
  const heapPct = mem ? Math.round((mem.heapUsedMb / mem.heapTotalMb) * 100) : 0;
  const envLabel = stats?.server?.environment ?? "—";
  const a = analyticsData;
  const auditLogs = auditData?.logs ?? [];

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:pb-8">

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/6 text-muted-foreground transition hover:bg-black/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-[22px] font-bold tracking-tight">System Monitor</h1>
            <p className="text-[12px] text-muted-foreground">Live platform health and stats</p>
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

        {/* ── Confirmation Dialog ── */}
        {showConfirmEnable && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
            data-testid="dialog-maintenance-confirm"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-100">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <h2 className="text-[17px] font-bold" data-testid="text-confirm-title">Enable Maintenance Mode?</h2>
              <p className="mt-2 text-[13px] text-muted-foreground" data-testid="text-confirm-body">
                This will return a <strong>503 Service Unavailable</strong> response from all health-check
                endpoints, causing app stores to show the app as under maintenance. All users will be
                affected immediately.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowConfirmEnable(false)}
                  className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-[13px] font-semibold transition hover:bg-black/5"
                  data-testid="button-cancel-maintenance"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmEnableMaintenance}
                  disabled={maintenanceMutation.isPending}
                  className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
                  data-testid="button-confirm-enable-maintenance"
                >
                  {maintenanceMutation.isPending ? "Enabling…" : "Enable"}
                </button>
              </div>
            </div>
          </div>
        )}

        {statsLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#35A8F7]" />
          </div>
        ) : statsError ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/70 py-16 text-center ring-1 ring-black/8" data-testid="stats-error">
            <XCircle className="h-8 w-8 text-red-400" />
            <div className="text-[14px] font-semibold text-red-600">Failed to load stats</div>
            <p className="max-w-xs text-[12px] text-muted-foreground">
              Could not reach the monitoring endpoint. Check your connection and permissions, then try again.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-1 rounded-xl px-4 py-2 text-[12px] font-semibold text-white"
              style={{ background: "#35A8F7" }}
              data-testid="button-retry"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-5">

            {/* ── Maintenance Mode ── */}
            <div
              className={cn(
                "overflow-hidden rounded-2xl ring-1",
                maintenanceData?.maintenance_mode
                  ? "bg-amber-50 ring-amber-300"
                  : "bg-white/70 ring-black/8"
              )}
              data-testid="section-maintenance-mode"
            >
              <div className="px-5 py-4 flex items-center gap-3">
                <div className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                  maintenanceData?.maintenance_mode ? "bg-amber-100" : "bg-black/6"
                )}>
                  <Wrench className={cn(
                    "h-5 w-5",
                    maintenanceData?.maintenance_mode ? "text-amber-600" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold">Maintenance Mode</div>
                  <div className="text-[11px] text-muted-foreground">
                    {maintenanceError
                      ? "Could not load status — toggle disabled until resolved"
                      : maintenanceData?.maintenance_mode
                      ? "Active — health endpoints are returning 503"
                      : "Inactive — platform is operating normally"}
                  </div>
                </div>
                {maintenanceLoading || maintenanceMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : maintenanceError ? (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-bold text-red-600" data-testid="text-maintenance-status-error">
                    Status unknown
                  </span>
                ) : (
                  <button
                    role="switch"
                    aria-checked={maintenanceData?.maintenance_mode ?? false}
                    onClick={() => handleMaintenanceToggle(!(maintenanceData?.maintenance_mode ?? false))}
                    disabled={maintenanceData === undefined}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                      maintenanceData?.maintenance_mode
                        ? "bg-amber-500 focus-visible:ring-amber-500"
                        : "bg-black/15 focus-visible:ring-[#35A8F7]"
                    )}
                    data-testid="toggle-maintenance-mode"
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200",
                        maintenanceData?.maintenance_mode ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                )}
              </div>
              {maintenanceData?.maintenance_mode && (
                <div className="border-t border-amber-200 px-5 py-2.5 flex items-center gap-2 bg-amber-100/50">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span className="text-[11px] font-semibold text-amber-700" data-testid="text-maintenance-warning">
                    All app store health checks are receiving 503 — users are being shown the maintenance screen.
                  </span>
                </div>
              )}
              {maintenanceMutation.isError && (
                <div className="border-t border-red-200 px-5 py-2.5 flex items-center gap-2 bg-red-50">
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  <span className="text-[11px] font-semibold text-red-600" data-testid="text-maintenance-error">
                    Failed to update maintenance mode. Please try again.
                  </span>
                </div>
              )}
            </div>

            {/* ── Status ── */}
            <div className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8">
              <div className="border-b border-black/5 px-5 py-3 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
                {lastFetched && (
                  <span className="text-[10px] text-muted-foreground" data-testid="last-fetched">
                    Updated {lastFetched}
                  </span>
                )}
              </div>
              <div className="divide-y divide-black/5">
                {/* Database */}
                <div className="flex items-center gap-3 px-5 py-4" data-testid="status-database">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#35A8F7]/10">
                    <Database className="h-4 w-4 text-[#35A8F7]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold">Database</div>
                    {stats?.db?.error && (
                      <div className="text-[11px] text-red-500">{stats.db.error}</div>
                    )}
                  </div>
                  <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold", dbOk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                    {dbOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {dbOk ? "Connected" : "Error"}
                  </div>
                </div>

                {/* Server uptime */}
                <div className="flex items-center gap-3 px-5 py-4" data-testid="status-server">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#35A8F7]/10">
                    <Server className="h-4 w-4 text-[#35A8F7]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold">Server</div>
                    <div className="text-[11px] text-muted-foreground">Node {stats?.server?.nodeVersion}</div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
                    <Activity className="h-3.5 w-3.5" />
                    Up {formatUptime(uptime)}
                  </div>
                </div>

                {/* Environment */}
                <div className="flex items-center gap-3 px-5 py-4" data-testid="status-environment">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#6C63FF]/10">
                    <Globe className="h-4 w-4 text-[#6C63FF]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold">Environment</div>
                  </div>
                  <span className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-bold capitalize",
                    envLabel === "production" ? "bg-emerald-100 text-emerald-700"
                      : envLabel === "development" ? "bg-amber-100 text-amber-700"
                      : "bg-black/6 text-muted-foreground"
                  )}>
                    {envLabel}
                  </span>
                </div>

                {/* Memory */}
                {mem && (
                  <div className="flex items-start gap-3 px-5 py-4" data-testid="status-memory">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#F59E0B]/10">
                      <Cpu className="h-4 w-4 text-[#F59E0B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold">Memory</span>
                        <span className="text-[11px] font-bold text-muted-foreground">{mem.heapUsedMb} / {mem.heapTotalMb} MB heap · {mem.rssMb} MB RSS</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/8">
                        <div
                          className={cn("h-full rounded-full transition-all", heapPct > 85 ? "bg-red-500" : heapPct > 65 ? "bg-amber-400" : "bg-emerald-400")}
                          style={{ width: `${heapPct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{heapPct}% heap utilization</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Platform Stats ── */}
            <div>
              <SectionLabel>Platform Stats</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Users"
                  value={s?.users?.total ?? "—"}
                  sub={s ? `+${s.users.new7d ?? "—"} this week` : undefined}
                  icon={Users}
                />
                <StatCard
                  label="Bubbles"
                  value={s?.bubbles?.total ?? "—"}
                  sub={s ? `${s.bubbles.approved} approved · ${s.bubbles.pending} pending` : undefined}
                  icon={Activity}
                />
                <StatCard
                  label="Events"
                  value={s?.events?.total ?? "—"}
                  sub={s ? `${s.events.upcoming ?? "—"} upcoming` : undefined}
                  icon={Calendar}
                  accent="#6C63FF"
                />
                <StatCard
                  label="Memberships"
                  value={s?.memberships?.total ?? "—"}
                  sub="total join records"
                  icon={CheckCircle2}
                  accent="#10B981"
                />
              </div>
            </div>

            {/* ── Growth ── */}
            <div>
              <SectionLabel>Growth</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <MiniStatCard
                  label="New users (7d)"
                  value={s?.users?.new7d ?? "—"}
                  icon={TrendingUp}
                  accent="#10B981"
                />
                <MiniStatCard
                  label="New users (30d)"
                  value={s?.users?.new30d ?? "—"}
                  icon={TrendingUp}
                  accent="#10B981"
                />
                <MiniStatCard
                  label="New bubbles (7d)"
                  value={s?.bubbles?.new7d ?? "—"}
                  icon={TrendingUp}
                  accent="#35A8F7"
                />
                <MiniStatCard
                  label="New bubbles (30d)"
                  value={s?.bubbles?.new30d ?? "—"}
                  icon={TrendingUp}
                  accent="#35A8F7"
                />
              </div>
            </div>

            {/* ── Content Health ── */}
            <div>
              <SectionLabel>Content Health</SectionLabel>
              <div className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8 divide-y divide-black/5">
                <InfoRow
                  label="Orphan bubbles"
                  value={
                    <span className={cn("font-bold", (s?.bubbles?.orphan ?? 0) > 0 ? "text-amber-600" : "text-emerald-600")}>
                      {s?.bubbles?.orphan ?? "—"}
                    </span>
                  }
                  icon={Ghost}
                  accent="#F59E0B"
                />
                <InfoRow
                  label="Avg members / bubble"
                  value={<span className="font-bold">{s?.bubbles?.avgMembers ?? "—"}</span>}
                  icon={BarChart2}
                  accent="#35A8F7"
                />
                <InfoRow
                  label="Rejected bubbles"
                  value={
                    <span className={cn("font-bold", (s?.bubbles?.rejected ?? 0) > 0 ? "text-red-500" : "text-emerald-600")}>
                      {s?.bubbles?.rejected ?? "—"}
                    </span>
                  }
                  icon={XCircle}
                  accent="#E8453C"
                />
                <InfoRow
                  label="Events this month"
                  value={<span className="font-bold">{s?.events?.thisMonth ?? "—"}</span>}
                  icon={Calendar}
                  accent="#6C63FF"
                />
                <InfoRow
                  label="Upcoming events"
                  value={<span className="font-bold">{s?.events?.upcoming ?? "—"}</span>}
                  icon={Clock}
                  accent="#6C63FF"
                />
              </div>
            </div>

            {/* ── Campus Mode ── */}
            <div>
              <SectionLabel>Campus Mode</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                <MiniStatCard
                  label="Campuses"
                  value={s?.campuses?.total ?? "—"}
                  icon={School}
                  accent="#6C63FF"
                />
                <MiniStatCard
                  label="Verified users"
                  value={s?.campuses?.verifiedUsers ?? "—"}
                  icon={CheckCircle2}
                  accent="#10B981"
                />
                <MiniStatCard
                  label="Campus bubbles"
                  value={s?.campuses?.campusBubbles ?? "—"}
                  icon={Activity}
                  accent="#35A8F7"
                />
              </div>
            </div>

            {/* ── Integrations ── */}
            <div>
              <SectionLabel>Integrations</SectionLabel>
              <div className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8 divide-y divide-black/5">
                {stats?.integrations && (
                  <>
                    <IntegrationRow
                      label="CometChat Messaging"
                      result={stats.integrations.cometChat}
                      icon={MessageSquare}
                    />
                    <IntegrationRow
                      label="Object Storage"
                      result={stats.integrations.objectStorage}
                      icon={HardDrive}
                    />
                  </>
                )}
              </div>
            </div>

            {/* ── Pending Review ── */}
            <div>
              <SectionLabel>Pending Review</SectionLabel>
              <div className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8 divide-y divide-black/5">
                <PendingRow
                  label="Bubbles"
                  count={s?.pendingReview?.bubbles ?? 0}
                  icon={Activity}
                  onClick={() => navigate("/admin/pending")}
                />
                <PendingRow
                  label="Events"
                  count={s?.pendingReview?.events ?? 0}
                  icon={Calendar}
                  onClick={() => navigate("/admin/pending")}
                />
                <PendingRow
                  label="Waitlist Requests"
                  count={s?.pendingReview?.waitlist ?? 0}
                  icon={Clock}
                  onClick={() => navigate("/admin/pending")}
                />
                <PendingRow
                  label="Reports"
                  count={s?.pendingReview?.reports ?? 0}
                  icon={AlertTriangle}
                  onClick={() => navigate("/admin/pending")}
                />
              </div>
            </div>

            {/* ── Analytics ── */}
            {a && (
              <div>
                <SectionLabel>Analytics</SectionLabel>
                <div className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8">
                  <div className="divide-y divide-black/5">
                    <MetricRow label="Daily Active Users (DAU)" value={a.dauMau.dau.toLocaleString()} />
                    <MetricRow label="Monthly Active Users (MAU)" value={a.dauMau.mau.toLocaleString()} />
                    <MetricRow label="Stickiness (DAU/MAU)" value={`${(a.dauMau.stickiness * 100).toFixed(1)}%`} />
                    <MetricRow label="Day-1 Retention" value={`${(a.retention.day1 * 100).toFixed(1)}%`} />
                    <MetricRow label="Day-7 Retention" value={`${(a.retention.day7 * 100).toFixed(1)}%`} />
                    <MetricRow label="Day-30 Retention" value={`${(a.retention.day30 * 100).toFixed(1)}%`} />
                    <MetricRow label="Avg Session Length" value={formatSeconds(a.sessionLength.averageSeconds)} />
                    <MetricRow label="Sessions/User (daily)" value={a.sessionsPerUser.daily.toFixed(2)} />
                    <MetricRow label="Sessions/User (weekly)" value={a.sessionsPerUser.weekly.toFixed(2)} />
                    <MetricRow label="Total Sessions" value={a.overview.totalSessions.toLocaleString()} />
                  </div>

                  {a.bubbleVisits.topBubbles.length > 0 && (
                    <>
                      <div className="border-t border-black/5 px-5 py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Top Bubbles by Visits
                        </span>
                      </div>
                      <div className="divide-y divide-black/5">
                        {a.bubbleVisits.topBubbles.slice(0, 5).map((b) => (
                          <div key={b.bubbleId} className="flex items-center justify-between px-5 py-2.5">
                            <span className="flex-1 truncate text-[13px]">{b.title}</span>
                            <span className="ml-3 text-[13px] font-bold">{b.visits.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Recent Admin Actions ── */}
            <div>
              <SectionLabel>Recent Admin Actions</SectionLabel>
              <div className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8">
                <div className="border-b border-black/5 px-5 py-3 flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Audit Log
                  </span>
                </div>
                {auditLogs.length === 0 ? (
                  <div className="px-5 py-8 text-center text-[12px] text-muted-foreground">No actions recorded yet</div>
                ) : (
                  <div className="divide-y divide-black/5">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="px-5 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[13px] font-semibold">{actionLabel(log.action)}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                          <span>Target: {log.targetId}</span>
                          {log.ip && <span>IP: {log.ip}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </AppShell>
  );
}
