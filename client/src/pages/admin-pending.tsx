import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Users,
  XCircle,
  Calendar,
  AlertTriangle,
  Shield,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

type Tab = "bubbles" | "events" | "waitlist" | "reports";

function formatDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="mb-3 h-10 w-10 text-black/15" />
      <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

function RejectModal({
  title,
  description,
  onConfirm,
  onClose,
  loading,
}: {
  title: string;
  description?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-[16px] font-bold">Reject: {title}</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {description ?? "Provide a reason (optional). It will be sent to the creator."}
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection…"
          rows={3}
          className="mt-3 w-full rounded-xl border border-black/10 bg-black/4 px-4 py-3 text-[13px] outline-none focus:ring-2 focus:ring-[#35A8F7]/40"
          data-testid="input-reject-reason"
        />
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-black/10 py-3 text-[13px] font-semibold text-muted-foreground transition hover:bg-black/5"
            data-testid="button-reject-cancel"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-[13px] font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
            data-testid="button-reject-confirm"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingBubblesTab() {
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);

  const { data: bubbles = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/pending-bubbles"],
    queryFn: () => apiRequest("GET", "/api/admin/pending-bubbles").then((r) => r.json()),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/admin/bubbles/${id}/approve`).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/pending-bubbles"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/admin/bubbles/${id}/reject`, { reason }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/pending-bubbles"] });
      setRejectTarget(null);
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#35A8F7]" />
      </div>
    );
  if (!bubbles.length)
    return <EmptyState icon={CheckCircle} label="No bubbles pending review" />;

  return (
    <>
      <div className="space-y-3">
        {bubbles.map((b: any) => (
          <div
            key={b.id}
            className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8"
            data-testid={`card-bubble-${b.id}`}
          >
            <div className="flex items-start gap-3 p-4">
              {b.coverImage || b.images?.[0] ? (
                <img
                  src={b.coverImage || b.images?.[0]}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#35A8F7]/10">
                  <Users className="h-6 w-6 text-[#35A8F7]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold" data-testid={`text-bubble-title-${b.id}`}>
                  {b.title}
                </div>
                <div className="mt-0.5 text-[12px] text-[#35A8F7] font-semibold">{b.category}</div>
                {b.tagline && (
                  <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                    {b.tagline}
                  </div>
                )}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Submitted {formatDate(b.createdAt)}
                </div>
              </div>
            </div>
            <div className="flex gap-2 border-t border-black/5 px-4 py-3">
              <button
                onClick={() => approveMutation.mutate(b.id)}
                disabled={approveMutation.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-[12px] font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                data-testid={`button-approve-bubble-${b.id}`}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5" />
                )}
                Approve
              </button>
              <button
                onClick={() => setRejectTarget({ id: b.id, title: b.title })}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2.5 text-[12px] font-semibold text-red-500 transition hover:bg-red-50"
                data-testid={`button-reject-bubble-${b.id}`}
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {rejectTarget && (
        <RejectModal
          title={rejectTarget.title}
          loading={rejectMutation.isPending}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => rejectMutation.mutate({ id: rejectTarget.id, reason })}
        />
      )}
    </>
  );
}

function PendingEventsTab() {
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);

  const { data: events = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/pending-events"],
    queryFn: () => apiRequest("GET", "/api/admin/pending-events").then((r) => r.json()),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/admin/events/${id}/approve`).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/pending-events"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/admin/events/${id}/reject`, { reason }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/pending-events"] });
      setRejectTarget(null);
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#35A8F7]" />
      </div>
    );
  if (!events.length) return <EmptyState icon={CheckCircle} label="No events pending review" />;

  return (
    <>
      <div className="space-y-3">
        {events.map((ev: any) => (
          <div
            key={ev.id}
            className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8"
            data-testid={`card-event-${ev.id}`}
          >
            <div className="flex items-start gap-3 p-4">
              {ev.coverImage ? (
                <img
                  src={ev.coverImage}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#35A8F7]/10">
                  <Calendar className="h-6 w-6 text-[#35A8F7]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold">{ev.title}</div>
                <div className="mt-0.5 text-[12px] font-semibold text-[#35A8F7]">
                  {ev.bubble?.title || "Unknown Bubble"}
                </div>
                {ev.date && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {formatDate(ev.date)}
                    {ev.startTime ? ` · ${ev.startTime}` : ""}
                  </div>
                )}
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  Submitted {formatDate(ev.createdAt)}
                </div>
              </div>
            </div>
            <div className="flex gap-2 border-t border-black/5 px-4 py-3">
              <button
                onClick={() => approveMutation.mutate(ev.id)}
                disabled={approveMutation.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-[12px] font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                data-testid={`button-approve-event-${ev.id}`}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5" />
                )}
                Approve
              </button>
              <button
                onClick={() => setRejectTarget({ id: ev.id, title: ev.title })}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2.5 text-[12px] font-semibold text-red-500 transition hover:bg-red-50"
                data-testid={`button-reject-event-${ev.id}`}
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {rejectTarget && (
        <RejectModal
          title={rejectTarget.title}
          loading={rejectMutation.isPending}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => rejectMutation.mutate({ id: rejectTarget.id, reason })}
        />
      )}
    </>
  );
}

function WaitlistTab() {
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<{ bubbleId: string; userId: string; name: string } | null>(null);

  const { data: waitlist = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/waitlist"],
    queryFn: () => apiRequest("GET", "/api/admin/waitlist").then((r) => r.json()),
  });

  const approveMutation = useMutation({
    mutationFn: ({ bubbleId, userId }: { bubbleId: string; userId: string }) =>
      apiRequest("POST", `/api/bubbles/${bubbleId}/join-requests/${userId}/approve`).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/waitlist"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ bubbleId, userId, reason }: { bubbleId: string; userId: string; reason: string }) =>
      apiRequest("POST", `/api/bubbles/${bubbleId}/join-requests/${userId}/reject`, { reason }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/waitlist"] });
      setRejectTarget(null);
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#35A8F7]" />
      </div>
    );
  if (!waitlist.length) return <EmptyState icon={Users} label="No pending join requests" />;

  return (
    <>
      <div className="space-y-3">
        {waitlist.map((item: any) => {
          const initials = (item.user?.name || "?")
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <div
              key={`${item.userId}-${item.bubbleId}`}
              className="flex items-center gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-black/8"
              data-testid={`card-waitlist-${item.userId}`}
            >
              {item.user?.profilePhoto ? (
                <img
                  src={item.user.profilePhoto}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: "#35A8F7" }}
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold">{item.user?.name || "Unknown"}</div>
                <div className="text-[12px] font-semibold text-[#35A8F7]">{item.bubbleTitle}</div>
                <div className="text-[10px] text-muted-foreground">
                  Requested {formatDate(item.createdAt)}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => approveMutation.mutate({ bubbleId: item.bubbleId, userId: item.userId })}
                  disabled={approveMutation.isPending}
                  className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-600 transition hover:bg-emerald-200 disabled:opacity-60"
                  data-testid={`button-approve-waitlist-${item.userId}`}
                >
                  <CheckCircle className="h-4 w-4" />
                </button>
                <button
                  onClick={() =>
                    setRejectTarget({
                      bubbleId: item.bubbleId,
                      userId: item.userId,
                      name: item.user?.name || "Unknown",
                    })
                  }
                  disabled={rejectMutation.isPending}
                  className="grid h-9 w-9 place-items-center rounded-full bg-red-100 text-red-500 transition hover:bg-red-200 disabled:opacity-60"
                  data-testid={`button-reject-waitlist-${item.userId}`}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {rejectTarget && (
        <RejectModal
          title={rejectTarget.name}
          description="Provide a reason (optional). It will be included in the notification sent to the user."
          loading={rejectMutation.isPending}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) =>
            rejectMutation.mutate({
              bubbleId: rejectTarget.bubbleId,
              userId: rejectTarget.userId,
              reason,
            })
          }
        />
      )}
    </>
  );
}

function ReportsTab() {
  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/reports"],
    queryFn: () => apiRequest("GET", "/api/admin/reports").then((r) => r.json()),
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#35A8F7]" />
      </div>
    );
  if (!reports.length) return <EmptyState icon={Shield} label="No reports to review" />;

  return (
    <div className="space-y-3">
      {reports.map((r: any) => (
        <div
          key={r.id}
          className="rounded-2xl bg-white/70 p-4 ring-1 ring-black/8"
          data-testid={`card-report-${r.id}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                {r.reportType?.replace(/_/g, " ") || "Report"}
              </span>
              <div className="mt-2 text-[13px] font-semibold">{r.reason}</div>
              {r.freeText && (
                <div className="mt-1 text-[12px] text-muted-foreground">{r.freeText}</div>
              )}
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                r.status === "pending"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              )}
            >
              {r.status}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              Reporter: <span className="font-semibold text-foreground">{r.reporter?.name}</span>
            </span>
            {r.reportedUser && (
              <span>
                Reported: <span className="font-semibold text-foreground">{r.reportedUser.name}</span>
              </span>
            )}
            {r.bubble && (
              <span>
                Bubble: <span className="font-semibold text-[#35A8F7]">{r.bubble.title}</span>
              </span>
            )}
            <span>{formatDate(r.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "bubbles", label: "Bubbles", icon: Users },
  { id: "events", label: "Events", icon: Calendar },
  { id: "waitlist", label: "Waitlist", icon: Clock },
  { id: "reports", label: "Reports", icon: AlertTriangle },
];

export default function AdminPending() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("bubbles");

  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
  });

  if (me && !me.isSuperAdmin) {
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
            <p className="text-[12px] text-muted-foreground">Content pending your review</p>
          </div>
        </div>

        <div className="mb-5 flex gap-1 rounded-2xl bg-black/6 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold transition",
                  tab === t.id
                    ? "bg-white shadow-sm text-[#35A8F7]"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`tab-${t.id}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "bubbles" && <PendingBubblesTab />}
        {tab === "events" && <PendingEventsTab />}
        {tab === "waitlist" && <WaitlistTab />}
        {tab === "reports" && <ReportsTab />}
      </div>
    </AppShell>
  );
}
