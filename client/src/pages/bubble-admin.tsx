import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Clock, PencilLine, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

function StatCard({
  label,
  value,
  onClick,
  testId,
}: {
  label: string;
  value: number;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-white/70 py-5 ring-1 ring-black/8 transition hover:bg-white"
      data-testid={testId}
    >
      <span className="text-[16px] font-bold">{value}</span>
      <span className="text-[13px] text-muted-foreground">{label}</span>
    </button>
  );
}

function PillButton({
  label,
  icon: Icon,
  onClick,
  testId,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-[54px] flex-1 items-center justify-between rounded-full bg-white/70 px-5 ring-1 ring-black/8 transition hover:bg-white"
      data-testid={testId}
    >
      <span className="flex items-center gap-2 text-[13px] font-semibold">
        <Icon className="h-4 w-4 text-[#35A8F7]" />
        {label}
      </span>
      <span className="text-[#35A8F7]">→</span>
    </button>
  );
}

export default function BubbleAdmin() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: bubble } = useQuery<any>({
    queryKey: [`/api/bubbles/${id}`],
    queryFn: () => apiRequest("GET", `/api/bubbles/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const { data: membershipData, isLoading: membershipLoading } = useQuery<any>({
    queryKey: [`/api/bubbles/${id}/membership`],
    queryFn: () => apiRequest("GET", `/api/bubbles/${id}/membership`).then((r) => r.json()),
    enabled: !!id && !!user,
    retry: false,
  });

  const isAdmin = membershipData?.role === "admin" || user?.isSuperAdmin === true;

  const { data: members } = useQuery<any[]>({
    queryKey: [`/api/bubbles/${id}/members`],
    queryFn: () => apiRequest("GET", `/api/bubbles/${id}/members`).then((r) => r.json()),
    enabled: !!id && isAdmin,
  });

  const { data: waitlist } = useQuery<{ waitlisted: any[]; on_hold: any[] }>({
    queryKey: [`/api/bubbles/${id}/waitlist`],
    queryFn: () => apiRequest("GET", `/api/bubbles/${id}/waitlist`).then((r) => r.json()),
    enabled: !!id && isAdmin,
  });

  useEffect(() => {
    if (!membershipLoading && membershipData && !isAdmin) {
      navigate(`/bubble/${id}`);
    }
  }, [membershipLoading, membershipData, isAdmin, id, navigate]);

  if (!id || membershipLoading) return null;
  if (!isAdmin) return null;

  const memberList = members ?? [];
  const memberCount = memberList.length;
  const adminCount = memberList.filter((m: any) => m.role === "admin").length;
  const waitlistCount = (waitlist?.waitlisted.length ?? 0) + (waitlist?.on_hold.length ?? 0);

  return (
    <AppShell active="bubbles">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate(`/bubble/${id}`)}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/6 text-muted-foreground transition hover:bg-black/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-[22px] font-bold tracking-tight" data-testid="text-admin-dashboard-title">
              {bubble?.title ? `${bubble.title} Dashboard` : "Admin Dashboard"}
            </h1>
          </div>
        </div>

        <div className="mb-6 flex gap-3">
          <StatCard
            label="Members"
            value={memberCount}
            onClick={() => navigate(`/bubble/${id}`)}
            testId="stat-members"
          />
          <StatCard
            label="Admins"
            value={adminCount}
            onClick={() => navigate(`/bubble/${id}`)}
            testId="stat-admins"
          />
          <StatCard
            label="Waitlisted"
            value={waitlistCount}
            onClick={() => navigate(`/bubble/${id}/waitlist`)}
            testId="stat-waitlisted"
          />
        </div>

        <div className="mb-3 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Admin Controls
        </div>
        <div className="space-y-3">
          <div className="flex gap-3">
            <PillButton
              label="Manage Members"
              icon={Users}
              onClick={() => navigate(`/bubble/${id}`)}
              testId="button-manage-members"
            />
            <PillButton
              label="Manage Waitlist"
              icon={Clock}
              onClick={() => navigate(`/bubble/${id}/waitlist`)}
              testId="button-manage-waitlist"
            />
          </div>
          <div className="flex gap-3">
            <PillButton
              label="Edit Bubble Info"
              icon={PencilLine}
              onClick={() => navigate(`/bubble/${id}/edit`)}
              testId="button-edit-bubble-info"
            />
            <PillButton
              label="Create Event"
              icon={Calendar}
              onClick={() => navigate(`/create-event?bubbleId=${id}`)}
              testId="button-create-event"
            />
          </div>

          <button
            onClick={() => navigate(user?.isSuperAdmin ? "/admin/pending" : "/needs-attention")}
            className="flex h-11 items-center gap-2 rounded-full bg-white/70 px-4 ring-1 ring-black/8 transition hover:bg-white"
            data-testid="button-needs-attention"
          >
            <Clock className="h-4 w-4" style={{ color: "#D97706" }} />
            <span className="text-[13px] font-semibold">Needs Attention</span>
            {waitlistCount > 0 && (
              <span
                className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold text-white"
                style={{ background: "#E8453C" }}
                data-testid="badge-needs-attention"
              >
                {waitlistCount}
              </span>
            )}
            <span className="ml-1 text-[#35A8F7]">→</span>
          </button>
        </div>
      </div>
    </AppShell>
  );
}
