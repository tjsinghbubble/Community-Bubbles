import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  XCircle,
  Clock,
  Gauge,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
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

interface EndpointMetric {
  method: string;
  endpoint: string;
  count: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
  maxMs: number;
  errorRate: number;
  lastSeenTs: number;
}

interface LatencyData {
  metrics: EndpointMetric[];
  generatedAt: string;
}

type SortKey = "p95Ms" | "p50Ms" | "p99Ms" | "avgMs" | "count" | "maxMs" | "errorRate";

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

function latencyColor(ms: number): string {
  if (ms < 200) return "text-emerald-600";
  if (ms < 500) return "text-amber-600";
  return "text-red-600";
}

function latencyBg(ms: number): string {
  if (ms < 200) return "bg-emerald-50";
  if (ms < 500) return "bg-amber-50";
  return "bg-red-50";
}

function fmt(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />;
  if (dir === "desc") return <ChevronDown className="h-3 w-3 text-[#35A8F7]" />;
  return <ChevronUp className="h-3 w-3 text-[#35A8F7]" />;
}

export default function AdminLatency() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>("p95Ms");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showConfirmReset, setShowConfirmReset] = useState(false);

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
  } = useQuery<LatencyData>({
    queryKey: ["/api/admin/latency"],
    queryFn: () => apiRequest("GET", "/api/admin/latency").then((r) => r.json()),
    enabled: !!user && me?.isSuperAdmin === true,
    refetchInterval: 30_000,
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/admin/latency").then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/latency"] });
      setShowConfirmReset(false);
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

  const metrics = data?.metrics ?? [];
  const sorted = [...metrics].sort((a, b) => {
    const diff = (a[sortKey] as number) - (b[sortKey] as number);
    return sortDir === "desc" ? -diff : diff;
  });

  const p95Slowest = metrics.length ? Math.max(...metrics.map((m) => m.p95Ms)) : 0;
  const totalRequests = metrics.reduce((s, m) => s + m.count, 0);
  const slowEndpoints = metrics.filter((m) => m.p95Ms >= 500).length;

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
            <h1 className="font-display text-[22px] font-bold tracking-tight">Latency Dashboard</h1>
            <p className="text-[12px] text-muted-foreground">
              p50 / p95 per endpoint — last {metrics.length > 0 ? `${totalRequests.toLocaleString()} requests` : "…"}
            </p>
          </div>
          <button
            onClick={() => setShowConfirmReset(true)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50"
            data-testid="button-reset"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Reset
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

        {/* Confirm reset dialog */}
        {showConfirmReset && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
            data-testid="dialog-reset-confirm"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-[17px] font-bold" data-testid="text-confirm-reset-title">Reset all metrics?</h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                This will clear all collected request samples from memory. New data will accumulate immediately.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-[13px] font-semibold transition hover:bg-black/5"
                  data-testid="button-cancel-reset"
                >
                  Cancel
                </button>
                <button
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending}
                  className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
                  data-testid="button-confirm-reset"
                >
                  {resetMutation.isPending ? "Clearing…" : "Clear data"}
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
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/70 py-16 text-center ring-1 ring-black/8" data-testid="latency-error">
            <XCircle className="h-8 w-8 text-red-400" />
            <div className="text-[14px] font-semibold text-red-600">Failed to load metrics</div>
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
              <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-4 ring-1 ring-black/8" data-testid="stat-card-endpoints">
                <div className="flex items-center gap-2">
                  <Gauge className="h-3.5 w-3.5 text-[#35A8F7]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Endpoints</span>
                </div>
                <div className="text-[26px] font-bold leading-none tracking-tight" data-testid="stat-value-endpoints">{metrics.length}</div>
                <div className="text-[10px] text-muted-foreground">{totalRequests.toLocaleString()} requests sampled</div>
              </div>
              <div className={cn("flex flex-col gap-2 rounded-2xl p-4 ring-1 ring-black/8", latencyBg(p95Slowest))} data-testid="stat-card-slowest-p95">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-[#35A8F7]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Slowest p95</span>
                </div>
                <div className={cn("text-[26px] font-bold leading-none tracking-tight", latencyColor(p95Slowest))} data-testid="stat-value-slowest-p95">
                  {metrics.length ? fmt(p95Slowest) : "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">across all endpoints</div>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-4 ring-1 ring-black/8" data-testid="stat-card-slow-endpoints">
                <div className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Slow (&gt;500ms)</span>
                </div>
                <div className={cn("text-[26px] font-bold leading-none tracking-tight", slowEndpoints > 0 ? "text-red-600" : "text-emerald-600")} data-testid="stat-value-slow-endpoints">
                  {slowEndpoints}
                </div>
                <div className="text-[10px] text-muted-foreground">endpoints with p95 ≥ 500ms</div>
              </div>
            </div>

            {/* Table */}
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/70 py-16 text-center ring-1 ring-black/8" data-testid="latency-empty">
                <Clock className="h-8 w-8 text-muted-foreground/40" />
                <div className="text-[14px] font-semibold text-muted-foreground">No data yet</div>
                <p className="max-w-xs text-[12px] text-muted-foreground">
                  Metrics accumulate as API requests are made. Try refreshing the page or making a few requests.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8" data-testid="latency-table">
                <div className="border-b border-black/5 px-5 py-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Endpoint Latency
                  </span>
                  {data?.generatedAt && (
                    <span className="text-[10px] text-muted-foreground" data-testid="latency-generated-at">
                      Updated {fmtTime(data.generatedAt)}
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-black/5 bg-black/2">
                        <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Endpoint
                        </th>
                        {(
                          [
                            { key: "p50Ms", label: "p50" },
                            { key: "p95Ms", label: "p95" },
                            { key: "p99Ms", label: "p99" },
                            { key: "avgMs", label: "Avg" },
                            { key: "maxMs", label: "Max" },
                            { key: "count", label: "Requests" },
                            { key: "errorRate", label: "5xx%" },
                          ] as { key: SortKey; label: string }[]
                        ).map(({ key, label }) => (
                          <th
                            key={key}
                            className="cursor-pointer select-none px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
                            onClick={() => handleSort(key)}
                            data-testid={`th-${key}`}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {label}
                              <SortIcon active={sortKey === key} dir={sortDir} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {sorted.map((m, i) => (
                        <tr
                          key={`${m.method}-${m.endpoint}`}
                          className="transition hover:bg-black/3"
                          data-testid={`row-endpoint-${i}`}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={cn(
                                  "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                  methodBadge(m.method),
                                )}
                                data-testid={`badge-method-${i}`}
                              >
                                {m.method}
                              </span>
                              <span
                                className="truncate font-mono text-[11px] text-foreground"
                                title={m.endpoint}
                                data-testid={`text-endpoint-${i}`}
                              >
                                {m.endpoint}
                              </span>
                            </div>
                            <div className="mt-0.5 pl-9 text-[9px] text-muted-foreground">
                              last seen {fmtTs(m.lastSeenTs)}
                            </div>
                          </td>
                          <td className={cn("px-4 py-3 text-right font-bold tabular-nums", latencyColor(m.p50Ms))} data-testid={`text-p50-${i}`}>
                            {fmt(m.p50Ms)}
                          </td>
                          <td
                            className={cn("px-4 py-3 text-right font-bold tabular-nums", latencyColor(m.p95Ms))}
                            data-testid={`text-p95-${i}`}
                          >
                            {fmt(m.p95Ms)}
                          </td>
                          <td
                            className={cn("px-4 py-3 text-right font-bold tabular-nums", latencyColor(m.p99Ms))}
                            data-testid={`text-p99-${i}`}
                          >
                            {fmt(m.p99Ms)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground" data-testid={`text-avg-${i}`}>
                            {fmt(m.avgMs)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground" data-testid={`text-max-${i}`}>
                            {fmt(m.maxMs)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums" data-testid={`text-count-${i}`}>
                            {m.count.toLocaleString()}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-right tabular-nums font-semibold",
                              m.errorRate > 0 ? "text-red-600" : "text-muted-foreground",
                            )}
                            data-testid={`text-error-rate-${i}`}
                          >
                            {m.errorRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-center text-[10px] text-muted-foreground">
              Data is held in-memory and resets on server restart. Sorted by{" "}
              <strong>{sortKey}</strong> {sortDir === "desc" ? "↓" : "↑"}.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
