import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  XCircle,
  Clock,
  Zap,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertTriangle,
  Settings2,
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

interface SlowCall {
  id: number;
  endpoint: string;
  method: string;
  durationMs: number;
  createdAt: string;
}

interface SlowCallsData {
  calls: SlowCall[];
  generatedAt: string;
  threshold: number;
}

interface SlowCallConfig {
  thresholdMs: number;
  retentionDays: number;
}

type SortKey = "durationMs" | "endpoint" | "createdAt";

function methodBadge(method: string) {
  const colors: Record<string, string> = {
    GET: "bg-sky-100 text-sky-700",
    POST: "bg-emerald-100 text-emerald-700",
    PUT: "bg-amber-100 text-amber-700",
    PATCH: "bg-purple-100 text-purple-700",
    DELETE: "bg-red-100 text-red-700",
  };
  return colors[method] ?? "bg-black/8 text-muted-foreground";
}

function durationColor(ms: number): string {
  if (ms < 3000) return "text-amber-600";
  if (ms < 5000) return "text-orange-600";
  return "text-red-600";
}

function fmt(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />;
  if (dir === "desc") return <ChevronDown className="h-3 w-3 text-[#35A8F7]" />;
  return <ChevronUp className="h-3 w-3 text-[#35A8F7]" />;
}

export default function AdminSlowCalls() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const { data: me, isLoading: meLoading, isError: meError } = useQuery<AuthMe>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
    retry: false,
  });

  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<SlowCallsData>({
    queryKey: ["/api/admin/slow-calls", sortKey, sortDir],
    queryFn: () =>
      apiRequest("GET", `/api/admin/slow-calls?sortBy=${sortKey}&sortDir=${sortDir}`).then((r) =>
        r.json()
      ),
    enabled: !!user && me?.isSuperAdmin === true,
    refetchInterval: 30_000,
  });

  const { data: config } = useQuery<SlowCallConfig>({
    queryKey: ["/api/admin/slow-call-config"],
    queryFn: () => apiRequest("GET", "/api/admin/slow-call-config").then((r) => r.json()),
    enabled: !!user && me?.isSuperAdmin === true,
    staleTime: 5 * 60 * 1000,
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/admin/slow-calls").then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slow-calls"] });
      setShowConfirmClear(false);
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

  if (meError) {
    return (
      <AppShell active="profile">
        <div className="mx-auto w-full max-w-3xl px-4 pt-20 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-400" />
          <div className="mt-3 text-[15px] font-semibold text-red-600">Could not verify permissions</div>
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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const calls = data?.calls ?? [];
  const threshold = data?.threshold ?? 2000;
  const maxDuration = calls.length ? Math.max(...calls.map((c) => c.durationMs)) : 0;
  const verySlowCount = calls.filter((c) => c.durationMs >= 5000).length;

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
            <h1 className="font-display text-[22px] font-bold tracking-tight">Slow API Calls</h1>
            <p className="text-[12px] text-muted-foreground">
              Calls exceeding {fmt(threshold)} threshold — last {calls.length} records ({config ? `${config.retentionDays}-day` : "90-day"} window)
            </p>
          </div>
          <button
            onClick={() => setShowConfirmClear(true)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50"
            data-testid="button-clear"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
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

        {/* Confirm clear dialog */}
        {showConfirmClear && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
            data-testid="dialog-clear-confirm"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-[17px] font-bold" data-testid="text-confirm-clear-title">
                Clear all slow call records?
              </h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                This permanently removes all slow call records from the database. New alerts will accumulate immediately.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-[13px] font-semibold transition hover:bg-black/5"
                  data-testid="button-cancel-clear"
                >
                  Cancel
                </button>
                <button
                  onClick={() => clearMutation.mutate()}
                  disabled={clearMutation.isPending}
                  className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
                  data-testid="button-confirm-clear"
                >
                  {clearMutation.isPending ? "Clearing…" : "Clear all"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#35A8F7]" />
          </div>
        ) : isError ? (
          <div
            className="flex flex-col items-center gap-3 rounded-2xl bg-white/70 py-16 text-center ring-1 ring-black/8"
            data-testid="slow-calls-error"
          >
            <XCircle className="h-8 w-8 text-red-400" />
            <div className="text-[14px] font-semibold text-red-600">Failed to load slow call data</div>
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

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div
                className="flex flex-col gap-2 rounded-2xl bg-white/70 p-4 ring-1 ring-black/8"
                data-testid="stat-card-total"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-[#35A8F7]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Total Alerts
                  </span>
                </div>
                <div
                  className={cn(
                    "text-[26px] font-bold leading-none tracking-tight",
                    calls.length > 0 ? "text-amber-600" : "text-emerald-600"
                  )}
                  data-testid="stat-value-total"
                >
                  {calls.length}
                </div>
                <div className="text-[10px] text-muted-foreground">slow calls recorded</div>
              </div>

              <div
                className={cn(
                  "flex flex-col gap-2 rounded-2xl p-4 ring-1 ring-black/8",
                  maxDuration >= 5000 ? "bg-red-50" : maxDuration >= 3000 ? "bg-amber-50" : "bg-white/70"
                )}
                data-testid="stat-card-slowest"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-[#35A8F7]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Slowest Call
                  </span>
                </div>
                <div
                  className={cn("text-[26px] font-bold leading-none tracking-tight", durationColor(maxDuration))}
                  data-testid="stat-value-slowest"
                >
                  {calls.length ? fmt(maxDuration) : "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">single worst response</div>
              </div>

              <div
                className="flex flex-col gap-2 rounded-2xl bg-white/70 p-4 ring-1 ring-black/8"
                data-testid="stat-card-very-slow"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Critical (&gt;5s)
                  </span>
                </div>
                <div
                  className={cn(
                    "text-[26px] font-bold leading-none tracking-tight",
                    verySlowCount > 0 ? "text-red-600" : "text-emerald-600"
                  )}
                  data-testid="stat-value-very-slow"
                >
                  {verySlowCount}
                </div>
                <div className="text-[10px] text-muted-foreground">calls over 5 seconds</div>
              </div>
            </div>

            {/* Active configuration */}
            {config && (
              <div
                className="rounded-2xl bg-white/70 ring-1 ring-black/8 px-5 py-4"
                data-testid="slow-call-config-panel"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Active Configuration
                  </span>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Slow-call threshold
                    </span>
                    <span
                      className="text-[15px] font-bold text-foreground"
                      data-testid="config-value-threshold"
                    >
                      {fmt(config.thresholdMs)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      SLOW_CALL_THRESHOLD_MS = {config.thresholdMs}
                    </span>
                  </div>
                  <div className="w-px self-stretch bg-black/8 hidden sm:block" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Retention window
                    </span>
                    <span
                      className="text-[15px] font-bold text-foreground"
                      data-testid="config-value-retention"
                    >
                      {config.retentionDays} {config.retentionDays === 1 ? "day" : "days"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      SLOW_CALL_RETENTION_DAYS = {config.retentionDays}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Table or empty state */}
            {calls.length === 0 ? (
              <div
                className="flex flex-col items-center gap-3 rounded-2xl bg-white/70 py-16 text-center ring-1 ring-black/8"
                data-testid="slow-calls-empty"
              >
                <Zap className="h-8 w-8 text-muted-foreground/40" />
                <div className="text-[14px] font-semibold text-muted-foreground">No slow calls recorded</div>
                <p className="max-w-xs text-[12px] text-muted-foreground">
                  Any API call taking more than {fmt(threshold)} will appear here. Looking good!
                </p>
              </div>
            ) : (
              <div
                className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8"
                data-testid="slow-calls-table"
              >
                <div className="border-b border-black/5 px-5 py-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Slow Call Log
                  </span>
                  {data?.generatedAt && (
                    <span className="text-[10px] text-muted-foreground" data-testid="slow-calls-generated-at">
                      Updated {new Date(data.generatedAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-black/5 bg-black/2">
                        <th
                          className="cursor-pointer select-none px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
                          onClick={() => handleSort("endpoint")}
                          data-testid="th-endpoint"
                        >
                          <div className="flex items-center gap-1">
                            Endpoint
                            <SortIcon active={sortKey === "endpoint"} dir={sortDir} />
                          </div>
                        </th>
                        <th
                          className="cursor-pointer select-none px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
                          onClick={() => handleSort("durationMs")}
                          data-testid="th-duration"
                        >
                          <div className="flex items-center justify-end gap-1">
                            Duration
                            <SortIcon active={sortKey === "durationMs"} dir={sortDir} />
                          </div>
                        </th>
                        <th
                          className="cursor-pointer select-none px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
                          onClick={() => handleSort("createdAt")}
                          data-testid="th-timestamp"
                        >
                          <div className="flex items-center justify-end gap-1">
                            Timestamp
                            <SortIcon active={sortKey === "createdAt"} dir={sortDir} />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {calls.map((call, i) => (
                        <tr
                          key={call.id}
                          className="transition hover:bg-black/3"
                          data-testid={`row-slow-call-${i}`}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={cn(
                                  "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                  methodBadge(call.method)
                                )}
                                data-testid={`badge-method-${i}`}
                              >
                                {call.method}
                              </span>
                              <span
                                className="truncate font-mono text-[11px] text-foreground"
                                title={call.endpoint}
                                data-testid={`text-endpoint-${i}`}
                              >
                                {call.endpoint}
                              </span>
                            </div>
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-right font-bold tabular-nums",
                              durationColor(call.durationMs)
                            )}
                            data-testid={`text-duration-${i}`}
                          >
                            {fmt(call.durationMs)}
                          </td>
                          <td
                            className="px-4 py-3 text-right tabular-nums text-muted-foreground"
                            data-testid={`text-timestamp-${i}`}
                          >
                            {fmtDateTime(call.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-center text-[10px] text-muted-foreground">
              Showing up to 200 most recent entries. Records auto-purge after {config ? config.retentionDays : 90} days.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
