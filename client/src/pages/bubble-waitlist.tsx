import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock, X } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

type WaitlistUser = { id: string; name: string; profilePhoto: string | null };
type WaitlistEntry = { id: string; userId: string; bubbleId: string; membershipStatus: "waitlisted" | "on_hold"; createdAt: string; user: WaitlistUser };

function WaitlistRow({
  entry,
  onApprove,
  onReject,
  pending,
}: {
  entry: WaitlistEntry;
  onApprove: () => void;
  onReject: () => void;
  pending: boolean;
}) {
  const initials = (entry.user?.name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex items-center gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-black/8"
      data-testid={`row-waitlist-${entry.userId}`}
    >
      {entry.user?.profilePhoto ? (
        <img src={entry.user.profilePhoto} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
          style={{ background: "#35A8F7" }}
        >
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-bold" data-testid={`text-waitlist-name-${entry.userId}`}>
            {entry.user?.name || "Unknown"}
          </span>
          {entry.membershipStatus === "on_hold" && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
              On Hold
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Requested {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          onClick={onApprove}
          disabled={pending}
          className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-600 transition hover:bg-emerald-200 disabled:opacity-60"
          data-testid={`button-approve-waitlist-${entry.userId}`}
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={onReject}
          disabled={pending}
          className="grid h-9 w-9 place-items-center rounded-full bg-red-100 text-red-500 transition hover:bg-red-200 disabled:opacity-60"
          data-testid={`button-reject-waitlist-${entry.userId}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function BubbleWaitlist() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [actingOn, setActingOn] = useState<string | null>(null);

  const { data: membershipData, isLoading: membershipLoading } = useQuery<any>({
    queryKey: [`/api/bubbles/${id}/membership`],
    queryFn: () => apiRequest("GET", `/api/bubbles/${id}/membership`).then((r) => r.json()),
    enabled: !!id && !!user,
    retry: false,
  });

  const isAdmin = membershipData?.role === "admin" || user?.isSuperAdmin === true;

  const { data: waitlist, isLoading: waitlistLoading } = useQuery<{ waitlisted: WaitlistEntry[]; on_hold: WaitlistEntry[] }>({
    queryKey: [`/api/bubbles/${id}/waitlist`],
    queryFn: () => apiRequest("GET", `/api/bubbles/${id}/waitlist`).then((r) => r.json()),
    enabled: !!id && isAdmin,
  });

  useEffect(() => {
    if (!membershipLoading && membershipData && !isAdmin) {
      navigate(`/bubble/${id}`);
    }
  }, [membershipLoading, membershipData, isAdmin, id, navigate]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [`/api/bubbles/${id}/waitlist`] });
    qc.invalidateQueries({ queryKey: [`/api/bubbles/${id}/members`] });
  };

  const approveMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", `/api/bubbles/${id}/waitlist/${userId}/approve`),
    onMutate: (userId) => setActingOn(userId),
    onSuccess: invalidate,
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Couldn't approve", description: err.message || "Please try again." });
    },
    onSettled: () => setActingOn(null),
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", `/api/bubbles/${id}/waitlist/${userId}/reject`),
    onMutate: (userId) => setActingOn(userId),
    onSuccess: invalidate,
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Couldn't remove", description: err.message || "Please try again." });
    },
    onSettled: () => setActingOn(null),
  });

  if (!id || membershipLoading) return null;
  if (!isAdmin) return null;

  const entries = [...(waitlist?.waitlisted ?? []), ...(waitlist?.on_hold ?? [])];

  return (
    <AppShell active="bubbles">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate(`/bubble/${id}/admin`)}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/6 text-muted-foreground transition hover:bg-black/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-[22px] font-bold tracking-tight">Waitlist</h1>
            <p className="text-[12px] text-muted-foreground">
              {entries.length} {entries.length === 1 ? "person" : "people"} waiting to join
            </p>
          </div>
        </div>

        {waitlistLoading ? (
          <div className="py-16 text-center text-[13px] text-muted-foreground">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-waitlist">
            <Clock className="mb-3 h-10 w-10 text-black/15" />
            <p className="text-[13px] font-semibold text-muted-foreground">No one is waiting to join</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <WaitlistRow
                key={entry.userId}
                entry={entry}
                pending={actingOn === entry.userId}
                onApprove={() => approveMutation.mutate(entry.userId)}
                onReject={() => rejectMutation.mutate(entry.userId)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
