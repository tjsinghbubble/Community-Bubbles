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
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";
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
type TimeRange = "1h" | "6h" | "24h";

interface TrendBucket {
  ts: number;
  p95Ms: number;
  p50Ms: number;
  avgMs: number;
  count: number;
}

interface EndpointTrend {
  method: string;
  endpoint: string;
  buckets: TrendBucket[];
}

interface SystemWideTrendBucket {
  ts: number;
  p95Ms: number;
  maxP95Ms: number;
  totalCount: number;
}

interface TrendsData {
  trends: EndpointTrend[];
  systemTrend: SystemWideTrendBucket[];
  range: TimeRange;
  generatedAt: string;
}

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

function sparklineColor(maxP95: number): string {
  if (maxP95 < 200) return "#10b981";
  if (maxP95 < 500) return "#f59e0b";
  return "#ef4444";
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

function fmtBucketTs(ts: number, range: TimeRange): string {
  const d = new Date(ts);
  if (range === "24h") {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />;
  if (dir === "desc") return <ChevronDown className="h-3 w-3 text-[#35A8F7]" />;
  return <ChevronUp className="h-3 w-3 text-[#35A8F7]" />;
}

function Sparkline({
  buckets,
  range,
  maxP95,
}: {
  buckets: TrendBucket[];
  range: TimeRange;
  maxP95: number;
}) {
  const color = sparklineColor(maxP95);
  const hasData = buckets.some((b) => b.count > 0);

  if (!hasData) {
    return (
      <div className="flex h-9 w-20 items-center justify-center">
        <span className="text-[9px] text-muted-foreground/50">no data</span>
      </div>
    );
  }

  const chartData = buckets.map((b) => ({
    ts: b.ts,
    p95Ms: b.count > 0 ? b.p95Ms : null,
    label: fmtBucketTs(b.ts, range),
  }));

  return (
    <div className="h-9 w-20" data-testid="sparkline-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="p95Ms"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sg-${color.replace("#", "")})`}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <RechartsTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { label: string; p95Ms: number | null };
              if (d.p95Ms == null) return null;
              return (
                <div className="rounded-lg bg-foreground/90 px-2 py-1 text-[10px] text-white shadow">
                  <div className="font-semibold">{fmt(d.p95Ms)} p95</div>
                  <div className="text-white/60">{d.label}</div>
                </div>
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SystemWideTrendChart({
  buckets,
  range,
  isFetching,
  timeRange,
  onRangeChange,
}: {
  buckets: SystemWideTrendBucket[];
  range: TimeRange;
  isFetching: boolean;
  timeRange: TimeRange;
  onRangeChange: (r: TimeRange) => void;
}) {
  const hasData = buckets.length > 0 && buckets.some((b) => b.totalCount > 0);

  const chartData = buckets.map((b) => ({
    ts: b.ts,
    p95Ms: b.totalCount > 0 ? b.p95Ms : null,
    maxP95Ms: b.totalCount > 0 ? b.maxP95Ms : null,
    label: fmtBucketTs(b.ts, range),
    count: b.totalCount,
  }));

  const allP95 = buckets.filter((b) => b.totalCount > 0).map((b) => b.maxP95Ms);
  const maxVal = allP95.length ? Math.max(...allP95) : 0;
  const chartColor = maxVal < 200 ? "#10b981" : maxVal < 500 ? "#f59e0b" : "#ef4444";

  const latestBucket = [...buckets].filter((b) => b.totalCount > 0).at(-1);
  const currentP95 = latestBucket?.p95Ms ?? 0;
  const currentMaxP95 = latestBucket?.maxP95Ms ?? 0;

  return (
    <div className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8" data-testid="system-trend-chart">
      <div className="border-b border-black/5 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-[#35A8F7]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            System-wide p95 Trend
          </span>
          {hasData && (
            <div className="flex items-center gap-2 ml-2">
              <span className={cn("text-[12px] font-bold tabular-nums", latencyColor(currentP95))} data-testid="text-system-p95">
                {fmt(currentP95)} weighted
              </span>
              <span className="text-[10px] text-muted-foreground">/</span>
              <span className={cn("text-[12px] font-bold tabular-nums", latencyColor(currentMaxP95))} data-testid="text-system-max-p95">
                {fmt(currentMaxP95)} max
              </span>
              <span className="text-[10px] text-muted-foreground">latest bucket</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-black/5 p-0.5" data-testid="system-trend-time-range-filter">
          {(["1h", "6h", "24h"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
                timeRange === r
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`button-system-range-${r}`}
            >
              {r}
            </button>
          ))}
          {isFetching && (
            <Loader2 className="mr-1 h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {!hasData ? (
          <div className="flex h-32 items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-center">
              <TrendingUp className="h-6 w-6 text-muted-foreground/30" />
              <span className="text-[12px] text-muted-foreground">No trend data yet for this window</span>
            </div>
          </div>
        ) : (
          <div className="h-40" data-testid="system-trend-area-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="systemP95Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="systemMaxP95Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => fmt(v)}
                  width={44}
                />
                <ReferenceLine y={500} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.4} />
                <ReferenceLine y={200} stroke="#f59e0b" strokeDasharray="4 2" strokeOpacity={0.3} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as {
                      label: string;
                      p95Ms: number | null;
                      maxP95Ms: number | null;
                      count: number;
                    };
                    if (d.p95Ms == null) return null;
                    return (
                      <div className="rounded-lg bg-foreground/90 px-3 py-2 text-[10px] text-white shadow">
                        <div className="font-semibold text-[11px]">{d.label}</div>
                        <div className="mt-1 flex gap-3">
                          <div>
                            <div className="text-white/60">Weighted p95</div>
                            <div className="font-bold">{fmt(d.p95Ms)}</div>
                          </div>
                          {d.maxP95Ms != null && (
                            <div>
                              <div className="text-white/60">Max p95</div>
                              <div className="font-bold">{fmt(d.maxP95Ms)}</div>
                            </div>
                          )}
                          <div>
                            <div className="text-white/60">Requests</div>
                            <div className="font-bold">{d.count.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="maxP95Ms"
                  stroke={chartColor}
                  strokeWidth={1}
                  strokeOpacity={0.4}
                  strokeDasharray="4 2"
                  fill="url(#systemMaxP95Grad)"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="p95Ms"
                  stroke={chartColor}
                  strokeWidth={2}
                  fill="url(#systemP95Grad)"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-1 flex items-center gap-4 px-1">
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 rounded" style={{ background: chartColor }} />
                <span className="text-[9px] text-muted-foreground">Weighted p95</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 rounded border-t border-dashed" style={{ borderColor: chartColor, opacity: 0.5 }} />
                <span className="text-[9px] text-muted-foreground">Max p95</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 rounded" style={{ background: "#ef4444", opacity: 0.4 }} />
                <span className="text-[9px] text-muted-foreground">500ms threshold</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export default function AdminLatency() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>("p95Ms");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");

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

  const {
    data: trendsData,
    isFetching: trendsFetching,
  } = useQuery<TrendsData>({
    queryKey: ["/api/admin/latency/trends", timeRange],
    queryFn: () =>
      apiRequest("GET", `/api/admin/latency/trends?range=${timeRange}`).then((r) => r.json()),
    enabled: !!user && me?.isSuperAdmin === true,
    refetchInterval: 30_000,
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/admin/latency").then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/latency"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/latency/trends"] });
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

  const trendsByKey = new Map<string, TrendBucket[]>();
  for (const t of trendsData?.trends ?? []) {
    trendsByKey.set(`${t.method} ${t.endpoint}`, t.buckets);
  }

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
                This will clear all collected request samples from memory and the database. New data will accumulate immediately.
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

            {/* System-wide p95 trend chart */}
            <SystemWideTrendChart
              buckets={trendsData?.systemTrend ?? []}
              range={trendsData?.range ?? timeRange}
              isFetching={trendsFetching}
              timeRange={timeRange}
              onRangeChange={setTimeRange}
            />

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
                  <div className="flex items-center gap-3">
                    {data?.generatedAt && (
                      <span className="text-[10px] text-muted-foreground" data-testid="latency-generated-at">
                        Updated {fmtTime(data.generatedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-black/5 bg-black/2">
                        <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Endpoint
                        </th>
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Trend (p95)
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
                      {sorted.map((m, i) => {
                        const buckets = trendsByKey.get(`${m.method} ${m.endpoint}`) ?? [];
                        const maxP95 = buckets.reduce((max, b) => Math.max(max, b.p95Ms), 0) || m.p95Ms;
                        return (
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
                            <td className="px-4 py-3" data-testid={`cell-trend-${i}`}>
                              <Sparkline buckets={buckets} range={timeRange} maxP95={maxP95} />
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-center text-[10px] text-muted-foreground">
              Metrics are persisted to the database every 5 minutes and survive server restarts. Sorted by{" "}
              <strong>{sortKey}</strong> {sortDir === "desc" ? "↓" : "↑"}.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
