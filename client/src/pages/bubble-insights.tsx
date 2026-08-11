import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Eye,
  UserPlus,
  Flag,
  CalendarDays,
  MessageSquare,
  Heart,
  Clock,
  XCircle,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

interface BubbleInsights {
  views: { last7d: number; last30d: number; trendPct: number | null };
  members: { new7d: number; new30d: number; pendingCount: number };
  reports: { last7d: number; openCount: number };
  content: { postsLast7d: number; eventsLast7d: number };
  engagement: { avgReactionsPerPost: number | null; avgRepliesPerPost: number | null };
  activity: { lastActivityAt: string | null; isQuiet: boolean };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
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
    <div
      className="flex flex-col gap-3 rounded-2xl bg-white/70 p-5 ring-1 ring-black/8"
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
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
        <div
          className="text-[28px] font-bold leading-none tracking-tight"
          data-testid={`stat-value-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {value}
        </div>
        {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "No activity yet";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function BubbleInsights() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: membershipData, isLoading: membershipLoading } = useQuery<any>({
    queryKey: [`/api/bubbles/${id}/membership`],
    queryFn: () => apiRequest("GET", `/api/bubbles/${id}/membership`).then((r) => r.json()),
    enabled: !!id && !!user,
    retry: false,
  });

  const isAdmin = membershipData?.role === "admin" || user?.isSuperAdmin === true;

  const {
    data: insights,
    isLoading: insightsLoading,
    isError,
  } = useQuery<BubbleInsights>({
    queryKey: [`/api/bubbles/${id}/insights`],
    queryFn: () => apiRequest("GET", `/api/bubbles/${id}/insights`).then((r) => r.json()),
    enabled: !!id && isAdmin,
  });

  useEffect(() => {
    if (!membershipLoading && membershipData && !isAdmin) {
      navigate(`/bubble/${id}`);
    }
  }, [membershipLoading, membershipData, isAdmin, id, navigate]);

  if (!id || membershipLoading || (isAdmin && insightsLoading)) return null;
  if (!isAdmin) return null;

  if (isError) {
    return (
      <AppShell active="bubbles">
        <div className="mx-auto w-full max-w-2xl px-4 pt-20 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-400" />
          <div className="mt-3 text-[15px] font-semibold text-red-600">Could not load insights</div>
          <p className="mt-1 text-[13px] text-muted-foreground">Please refresh or try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white"
            style={{ background: "#35A8F7" }}
            data-testid="button-retry-insights"
          >
            Refresh
          </button>
        </div>
      </AppShell>
    );
  }

  const views = insights?.views;
  const members = insights?.members;
  const reports = insights?.reports;
  const content = insights?.content;
  const engagement = insights?.engagement;
  const activity = insights?.activity;

  return (
    <AppShell active="bubbles">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:pb-8">
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => navigate(`/bubble/${id}`)}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/6 text-muted-foreground transition hover:bg-black/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-[22px] font-bold tracking-tight">Insights</h1>
            <p className="text-[12px] text-muted-foreground">Last 7 and 30 days of activity for this bubble</p>
          </div>
        </div>

        {activity?.isQuiet && (
          <div
            className="mb-5 flex items-center gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200"
            data-testid="banner-quiet-bubble"
          >
            <Clock className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <div className="text-[13px] font-semibold text-amber-800">This bubble has gone quiet</div>
              <div className="text-[12px] text-amber-700">
                Last activity: {formatRelativeTime(activity.lastActivityAt)}
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <SectionLabel>Engagement</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Views (7d)"
              value={views?.last7d ?? "—"}
              sub={
                views?.trendPct !== null && views?.trendPct !== undefined
                  ? `${views.trendPct >= 0 ? "↑" : "↓"} ${Math.abs(views.trendPct)}% vs prior week`
                  : `${views?.last30d ?? "—"} in last 30d`
              }
              icon={Eye}
            />
            <StatCard
              label="Last Activity"
              value={formatRelativeTime(activity?.lastActivityAt ?? null)}
              icon={Clock}
              accent="#6C63FF"
            />
          </div>
        </div>

        <div className="mb-6">
          <SectionLabel>Growth</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="New Members (7d)"
              value={members?.new7d ?? "—"}
              sub={`${members?.new30d ?? "—"} in last 30d`}
              icon={UserPlus}
              accent="#10B981"
            />
            <StatCard
              label="Pending Requests"
              value={members?.pendingCount ?? "—"}
              icon={UserPlus}
              accent="#10B981"
            />
          </div>
        </div>

        <div className="mb-6">
          <SectionLabel>Health & Safety</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Reports (7d)"
              value={reports?.last7d ?? "—"}
              sub={reports?.openCount ? `${reports.openCount} open` : "all clear"}
              icon={Flag}
              accent={reports?.openCount ? "#E8453C" : "#10B981"}
            />
            <StatCard
              label="Posts & Events (7d)"
              value={(content?.postsLast7d ?? 0) + (content?.eventsLast7d ?? 0)}
              sub={`${content?.postsLast7d ?? 0} posts · ${content?.eventsLast7d ?? 0} events`}
              icon={CalendarDays}
              accent="#35A8F7"
            />
          </div>
        </div>

        <div>
          <SectionLabel>Bulletin Engagement (30d)</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Avg Reactions / Post"
              value={engagement?.avgReactionsPerPost ?? "—"}
              icon={Heart}
              accent="#E8453C"
            />
            <StatCard
              label="Avg Replies / Post"
              value={engagement?.avgRepliesPerPost ?? "—"}
              icon={MessageSquare}
              accent="#6C63FF"
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
