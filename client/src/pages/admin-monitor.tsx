import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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

interface AdminStats {
  db: { status: "connected" | "error"; error: string | null };
  server: { uptimeSeconds: number; nodeVersion: string };
  stats: {
    users: { total: number };
    bubbles: { total: number; approved: number; pending: number; rejected: number };
    events: { total: number; approved: number; pending: number };
    memberships: { total: number };
    pendingReview: { bubbles: number; events: number; waitlist: number; reports: number };
  };
  fetchedAt: string;
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

export default function AdminMonitor() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: me, isLoading: meLoading } = useQuery<AuthMe>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
  });

  const {
    data: stats,
    isLoading: statsLoading,
    isFetching,
    isError: statsError,
    refetch,
    dataUpdatedAt,
  } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => apiRequest("GET", "/api/admin/stats").then((r) => r.json()),
    enabled: !!user && me?.isSuperAdmin === true,
    refetchInterval: 30_000,
  });

  // Redirect non-authenticated and non-super-admin users
  useEffect(() => {
    if (!user && !meLoading) {
      navigate("/profile");
      return;
    }
    if (me && !me.isSuperAdmin) {
      navigate("/profile");
    }
  }, [user, me, meLoading, navigate]);

  // Show nothing while resolving auth — prevents shell flash for non-admins
  if (!user || meLoading || (me && !me.isSuperAdmin)) {
    return null;
  }

  const dbOk = stats?.db?.status === "connected";
  const uptime = stats?.server?.uptimeSeconds ?? 0;
  const s = stats?.stats;
  const lastFetched = dataUpdatedAt ? formatTime(new Date(dataUpdatedAt).toISOString()) : null;

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

            {/* Status row */}
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
              </div>
            </div>

            {/* Platform stats grid */}
            <div>
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                Platform Stats
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Users"
                  value={s?.users?.total ?? "—"}
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
                  sub={s ? `${s.events.approved} approved · ${s.events.pending} pending` : undefined}
                  icon={Calendar}
                  accent="#6C63FF"
                />
                <StatCard
                  label="Memberships"
                  value={s?.memberships?.total ?? "—"}
                  sub="total members"
                  icon={CheckCircle2}
                  accent="#10B981"
                />
              </div>
            </div>

            {/* Pending review */}
            <div className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8">
              <div className="border-b border-black/5 px-5 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Pending Review
                </span>
              </div>
              <div className="divide-y divide-black/5">
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

          </div>
        )}
      </div>
    </AppShell>
  );
}
