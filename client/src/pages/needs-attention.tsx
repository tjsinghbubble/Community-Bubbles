import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Check, Clock, Flag, Loader2, X } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Tab = "events" | "waitlist" | "reports";

function formatDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="mb-3 h-10 w-10 text-black/15" />
      <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

function EventsTab() {
  const { data: events = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/pending-events"],
    queryFn: () => apiRequest("GET", "/api/admin/pending-events").then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#35A8F7]" />
      </div>
    );
  }
  if (!events.length) return <EmptyState icon={Calendar} label="No pending events in your bubbles" />;

  return (
    <div className="space-y-3">
      {events.map((ev: any) => (
        <div key={ev.id} className="overflow-hidden rounded-2xl bg-white/70 p-4 ring-1 ring-black/8" data-testid={`card-pending-event-${ev.id}`}>
          <div className="text-[12px] font-semibold text-[#35A8F7]">{ev.bubble?.title || "Unknown Bubble"}</div>
          <div className="mt-1 text-[14px] font-bold">{ev.title}</div>
          {ev.date && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {formatDate(ev.date)}
              {ev.startTime ? ` · ${ev.startTime}` : ""}
            </div>
          )}
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            Awaiting platform review — our team will approve or reject this shortly.
          </div>
        </div>
      ))}
    </div>
  );
}

function WaitlistTab() {
  const qc = useQueryClient();
  const [actingOn, setActingOn] = useState<string | null>(null);

  const { data: waitlist = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/waitlist"],
    queryFn: () => apiRequest("GET", "/api/admin/waitlist").then((r) => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/admin/waitlist"] });

  const approveMutation = useMutation({
    mutationFn: ({ bubbleId, userId }: { bubbleId: string; userId: string }) =>
      apiRequest("POST", `/api/bubbles/${bubbleId}/waitlist/${userId}/approve`),
    onMutate: ({ userId }) => setActingOn(userId),
    onSuccess: invalidate,
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Couldn't approve", description: err.message || "Please try again." });
    },
    onSettled: () => setActingOn(null),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ bubbleId, userId }: { bubbleId: string; userId: string }) =>
      apiRequest("POST", `/api/bubbles/${bubbleId}/waitlist/${userId}/reject`),
    onMutate: ({ userId }) => setActingOn(userId),
    onSuccess: invalidate,
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Couldn't remove", description: err.message || "Please try again." });
    },
    onSettled: () => setActingOn(null),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#35A8F7]" />
      </div>
    );
  }
  if (!waitlist.length) return <EmptyState icon={Clock} label="No pending join requests" />;

  return (
    <div className="space-y-3">
      {waitlist.map((item: any) => {
        const initials = (item.user?.name || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
        const pending = actingOn === item.userId;
        return (
          <div
            key={`${item.userId}-${item.bubbleId}`}
            className="flex items-center gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-black/8"
            data-testid={`card-waitlist-${item.userId}`}
          >
            {item.user?.profilePhoto ? (
              <img src={item.user.profilePhoto} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: "#35A8F7" }}>
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold">{item.user?.name || "Unknown"}</div>
              <div className="text-[12px] font-semibold text-[#35A8F7]">{item.bubbleTitle}</div>
              <div className="text-[10px] text-muted-foreground">Requested {formatDate(item.createdAt)}</div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => approveMutation.mutate({ bubbleId: item.bubbleId, userId: item.userId })}
                disabled={pending}
                className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-600 transition hover:bg-emerald-200 disabled:opacity-60"
                data-testid={`button-approve-waitlist-${item.userId}`}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => rejectMutation.mutate({ bubbleId: item.bubbleId, userId: item.userId })}
                disabled={pending}
                className="grid h-9 w-9 place-items-center rounded-full bg-red-100 text-red-500 transition hover:bg-red-200 disabled:opacity-60"
                data-testid={`button-reject-waitlist-${item.userId}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportsTab({ adminBubbles }: { adminBubbles: any[] }) {
  const qc = useQueryClient();

  const reportQueries = useQueries({
    queries: adminBubbles.map((b) => ({
      queryKey: [`/api/bubbles/${b.id}/reports`],
      queryFn: () => apiRequest("GET", `/api/bubbles/${b.id}/reports`).then((r) => r.json()),
      enabled: adminBubbles.length > 0,
    })),
  });

  const isLoading = reportQueries.some((q) => q.isLoading);
  const reports = reportQueries.flatMap((q, i) =>
    (q.data ?? []).map((r: any) => ({ ...r, bubble: r.bubble ?? { id: adminBubbles[i].id, title: adminBubbles[i].title } })),
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "resolved" | "dismissed" }) =>
      apiRequest("PATCH", `/api/reports/${id}/status`, { status }).then((r) => r.json()),
    onSuccess: () => {
      for (const b of adminBubbles) qc.invalidateQueries({ queryKey: [`/api/bubbles/${b.id}/reports`] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Couldn't update report", description: err.message || "Please try again." });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#35A8F7]" />
      </div>
    );
  }

  const pending = reports.filter((r: any) => r.status === "pending");
  if (!pending.length) return <EmptyState icon={Flag} label="No reports to review" />;

  return (
    <div className="space-y-3">
      {pending.map((r: any) => (
        <div key={r.id} className="rounded-2xl bg-white/70 p-4 ring-1 ring-black/8" data-testid={`card-report-${r.id}`}>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
            {r.reportType?.replace(/_/g, " ") || "Report"}
          </span>
          <div className="mt-2 text-[13px] font-semibold">{r.reason}</div>
          {r.freeText && <div className="mt-1 text-[12px] text-muted-foreground">{r.freeText}</div>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>Bubble: <span className="font-semibold text-[#35A8F7]">{r.bubble?.title}</span></span>
            <span>{formatDate(r.createdAt)}</span>
          </div>
          <div className="mt-3 flex gap-2 border-t border-black/5 pt-3">
            <button
              onClick={() => statusMutation.mutate({ id: r.id, status: "resolved" })}
              disabled={statusMutation.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-[12px] font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
              data-testid={`button-resolve-report-${r.id}`}
            >
              <Check className="h-3.5 w-3.5" />
              Resolve
            </button>
            <button
              onClick={() => statusMutation.mutate({ id: r.id, status: "dismissed" })}
              disabled={statusMutation.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-black/10 py-2.5 text-[12px] font-semibold text-muted-foreground transition hover:bg-black/5 disabled:opacity-60"
              data-testid={`button-dismiss-report-${r.id}`}
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "events", label: "Events", icon: Calendar },
  { id: "waitlist", label: "Waitlist", icon: Clock },
  { id: "reports", label: "Reports", icon: Flag },
];

export default function NeedsAttention() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("events");

  const { data: myBubbles } = useQuery<any[]>({
    queryKey: ["/api/bubbles/my"],
    queryFn: () => apiRequest("GET", "/api/bubbles/my").then((r) => r.json()),
    enabled: !!user,
  });

  const adminBubbles = (myBubbles ?? []).filter((b: any) => b.role === "admin");

  if (user && myBubbles && adminBubbles.length === 0 && !user.isSuperAdmin) {
    navigate("/profile");
    return null;
  }

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:pb-8">
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/6 text-muted-foreground transition hover:bg-black/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-display text-[22px] font-bold tracking-tight">Needs Attention</h1>
            <p className="text-[12px] text-muted-foreground">Across the bubbles you admin</p>
          </div>
        </div>

        <div className="mb-5 flex gap-2 rounded-2xl bg-black/[0.04] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-semibold transition",
                tab === t.id ? "bg-white text-black shadow-sm" : "text-muted-foreground",
              )}
              data-testid={`tab-${t.id}`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "events" && <EventsTab />}
        {tab === "waitlist" && <WaitlistTab />}
        {tab === "reports" && <ReportsTab adminBubbles={adminBubbles} />}
      </div>
    </AppShell>
  );
}
