import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CalendarDays, Clock, MapPin, Users, Loader2, Check, Flag,
  MoreHorizontal, Send, Crown, Pencil, Plus, Trash2, ClipboardList,
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const BLUE = "#35A8F7";
const RED = "#E8453C";

function ReportEventModal({ open, onClose, eventId, bubbleId }: { open: boolean; onClose: () => void; eventId: string; bubbleId: string }) {
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  const reportMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/reports", {
        bubbleId,
        eventId,
        reportType: "event",
        reason: "Other",
        freeText: reason.trim(),
      }),
    onSuccess: () => {
      setSent(true);
      setTimeout(() => { onClose(); setSent(false); setReason(""); }, 1500);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Couldn't submit report", description: err.message || "Please try again." });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>Report this Event</DialogTitle>
          <DialogDescription>Describe the issue and our team will review it.</DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Check className="h-10 w-10 text-emerald-500" />
            <div className="font-semibold text-black/70">Report submitted</div>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What's going on?"
              rows={4}
              className="w-full resize-none rounded-xl border border-black/10 bg-[#FAFAFA] px-3 py-2.5 text-[13px] outline-none"
              data-testid="input-report-event-reason"
            />
            <button
              onClick={() => reason.trim() && reportMutation.mutate()}
              disabled={!reason.trim() || reportMutation.isPending}
              className="h-11 w-full rounded-2xl text-[14px] font-semibold text-white disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${BLUE}, #6C63FF)` }}
              data-testid="button-submit-report-event"
            >
              {reportMutation.isPending ? "Submitting…" : "Submit Report"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddTaskDialog({
  open,
  onClose,
  eventId,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [spotsNeeded, setSpotsNeeded] = useState("");
  const [icon, setIcon] = useState("📋");

  const close = () => {
    setTitle("");
    setDescription("");
    setSpotsNeeded("");
    setIcon("📋");
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/events/${eventId}/signup-tasks`, {
        title: title.trim(),
        description: description.trim() || undefined,
        icon,
        spotsNeeded: spotsNeeded ? Number(spotsNeeded) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/events/${eventId}/signup-tasks`] });
      close();
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Couldn't add task", description: err.message || "Please try again." });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>Add Sign-up Task</DialogTitle>
          <DialogDescription>Let members volunteer for something you need help with.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value.slice(0, 2))}
              className="w-14 rounded-xl border border-black/10 bg-[#FAFAFA] px-3 py-2.5 text-center text-[18px] outline-none"
              data-testid="input-task-icon"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="flex-1 rounded-xl border border-black/10 bg-[#FAFAFA] px-3 py-2.5 text-[13px] outline-none"
              data-testid="input-task-title"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details (optional)"
            rows={3}
            className="w-full resize-none rounded-xl border border-black/10 bg-[#FAFAFA] px-3 py-2.5 text-[13px] outline-none"
            data-testid="input-task-description"
          />
          <input
            type="number"
            min={1}
            value={spotsNeeded}
            onChange={(e) => setSpotsNeeded(e.target.value)}
            placeholder="Spots needed (leave blank for unlimited)"
            className="w-full rounded-xl border border-black/10 bg-[#FAFAFA] px-3 py-2.5 text-[13px] outline-none"
            data-testid="input-task-spots"
          />
          <button
            onClick={() => title.trim() && createMutation.mutate()}
            disabled={!title.trim() || createMutation.isPending}
            className="h-11 w-full rounded-2xl text-[14px] font-semibold text-white disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${BLUE}, #6C63FF)` }}
            data-testid="button-submit-task"
          >
            {createMutation.isPending ? "Adding…" : "Add Task"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VolunteerTasks({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: [`/api/events/${eventId}/signup-tasks`],
    queryFn: () => apiRequest("GET", `/api/events/${eventId}/signup-tasks`).then((r) => r.json()),
  });

  const joinMutation = useMutation({
    mutationFn: (taskId: number) => apiRequest("POST", `/api/events/signup-tasks/${taskId}/join`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/events/${eventId}/signup-tasks`] }),
    onError: (err: any) => toast({ variant: "destructive", title: "Couldn't sign up", description: err.message || "Please try again." }),
  });

  const leaveMutation = useMutation({
    mutationFn: (taskId: number) => apiRequest("DELETE", `/api/events/signup-tasks/${taskId}/join`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/events/${eventId}/signup-tasks`] }),
    onError: (err: any) => toast({ variant: "destructive", title: "Couldn't cancel sign-up", description: err.message || "Please try again." }),
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => apiRequest("DELETE", `/api/events/${eventId}/signup-tasks/${taskId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/events/${eventId}/signup-tasks`] }),
    onError: (err: any) => toast({ variant: "destructive", title: "Couldn't remove task", description: err.message || "Please try again." }),
  });

  if (!tasks.length && !canManage) return null;

  return (
    <div className="mt-4 rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          Volunteer Tasks
        </div>
        {canManage && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: BLUE }}
            data-testid="button-add-task"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-[13px] text-muted-foreground" data-testid="text-no-tasks">
          No sign-up tasks yet.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t: any) => (
            <div key={t.id} className="flex items-start gap-3 rounded-xl bg-black/[0.02] p-3" data-testid={`row-task-${t.id}`}>
              <span className="text-[18px]">{t.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold" data-testid={`text-task-title-${t.id}`}>{t.title}</div>
                {t.description && <div className="text-[12px] text-muted-foreground">{t.description}</div>}
                <div className="mt-1 text-[11px] text-muted-foreground" data-testid={`text-task-spots-${t.id}`}>
                  {t.signupCount} signed up{t.spotsNeeded ? ` / ${t.spotsNeeded} spots` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {t.hasSignedUp ? (
                  <button
                    onClick={() => leaveMutation.mutate(t.id)}
                    disabled={leaveMutation.isPending}
                    className="rounded-full border border-red-400/60 px-3 py-1.5 text-[11px] font-semibold text-red-500"
                    data-testid={`button-leave-task-${t.id}`}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    onClick={() => joinMutation.mutate(t.id)}
                    disabled={joinMutation.isPending || (t.spotsNeeded != null && t.signupCount >= t.spotsNeeded)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                    style={{ background: `linear-gradient(135deg, ${BLUE}, #6C63FF)` }}
                    data-testid={`button-join-task-${t.id}`}
                  >
                    {t.spotsNeeded != null && t.signupCount >= t.spotsNeeded ? "Full" : "Sign Up"}
                  </button>
                )}
                {canManage && (
                  <button
                    onClick={() => deleteMutation.mutate(t.id)}
                    className="text-muted-foreground"
                    data-testid={`button-delete-task-${t.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddTaskDialog open={addOpen} onClose={() => setAddOpen(false)} eventId={eventId} />
    </div>
  );
}

function Participants({ attendees }: { attendees: any[] }) {
  const [, navigate] = useLocation();
  const going = attendees.filter((a) => a.status === "going" || a.status === "waitlisted");
  if (!going.length) return null;

  return (
    <div className="mt-4 rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Users className="h-4 w-4 text-muted-foreground" />
        Participants ({going.length})
      </div>
      <div className="space-y-1">
        {going.map((a) => (
          <button
            key={a.id}
            onClick={() => navigate(`/profile/view/${a.userId}`)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-black/5"
            data-testid={`row-participant-${a.userId}`}
          >
            {a.user?.profilePhoto ? (
              <img src={a.user.profilePhoto} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#35A8F7]/10 text-[12px] font-bold text-[#35A8F7]">
                {(a.user?.name || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{a.user?.name}</span>
            {a.status === "waitlisted" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Waitlist</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);

  const { data: event, isLoading } = useQuery<any>({
    queryKey: [`/api/events/${id}`],
    queryFn: () => fetch(`/api/events/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const { data: attendees } = useQuery<any[]>({
    queryKey: [`/api/events/${id}/attendees`],
    queryFn: () => fetch(`/api/events/${id}/attendees`).then((r) => r.json()),
    enabled: !!id,
  });

  const { data: myEvents } = useQuery<any[]>({
    queryKey: ["/api/events/my"],
    queryFn: () => apiRequest("GET", "/api/events/my").then((r) => r.json()),
    enabled: !!user,
  });

  // API errors return a JSON object, not an array — never crash on them
  const attendeeList = Array.isArray(attendees) ? attendees : [];
  const myEventsList = Array.isArray(myEvents) ? myEvents : [];
  const myRsvp = attendeeList.find((a: any) => a.userId === user?.id);
  const isGoing = myRsvp?.status === "going" || myEventsList.some((e: any) => e.id === id);
  const isWaitlisted = myRsvp?.status === "waitlisted";
  const goingCount = attendeeList.filter((a: any) => a.status === "going").length;

  const rsvpMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/events/${id}/rsvp`, { status: "going" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/events/${id}/attendees`] });
      qc.invalidateQueries({ queryKey: ["/api/events/my"] });
      qc.invalidateQueries({ queryKey: ["/api/events/upcoming"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Couldn't RSVP", description: err.message || "Please try again." });
    },
  });

  const cancelRsvpMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/events/${id}/rsvp`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/events/${id}/attendees`] });
      qc.invalidateQueries({ queryKey: ["/api/events/my"] });
      qc.invalidateQueries({ queryKey: ["/api/events/upcoming"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Couldn't cancel RSVP", description: err.message || "Please try again." });
    },
  });

  if (isLoading || !event || !event.id) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background" data-testid="loading-event-details">
        <div className="text-sm text-muted-foreground">{isLoading ? "Loading…" : "Event not found"}</div>
      </div>
    );
  }

  const isOrganizer = event.createdBy === user?.id;
  let dateLabel = event.date;
  try { dateLabel = format(parseISO(event.date), "EEEE, MMMM d"); } catch {}

  const shareEvent = () => {
    const url = `${window.location.origin}/event/${id}`;
    if (navigator.share) navigator.share({ title: event.title, url }).catch(() => {});
    else navigator.clipboard.writeText(url);
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/85 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => {
            // wouter has no numeric navigation — go back in browser history,
            // falling back to the parent bubble when opened directly via link
            if (window.history.length > 1) window.history.back();
            else navigate(`/bubble/${event.bubbleId}`);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full"
          data-testid="button-event-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="truncate px-2 text-[16px] font-bold" data-testid="text-event-details-title">{event.title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-10 w-10 items-center justify-center rounded-full" data-testid="button-event-kebab">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl border-0 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.14)]">
            <DropdownMenuItem className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]" onClick={shareEvent} data-testid="action-share-event-details">
              <Send className="h-[18px] w-[18px] text-black/60" />
              Share Event
            </DropdownMenuItem>
            {isOrganizer && (
              <DropdownMenuItem className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]" style={{ color: BLUE }} onClick={() => navigate(`/event/${id}/edit`)} data-testid="action-edit-event-details">
                <Pencil className="h-[18px] w-[18px]" style={{ color: BLUE }} />
                Edit Event
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="my-1 bg-black/6" />
            <DropdownMenuItem className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]" style={{ color: RED }} onClick={() => setReportOpen(true)} data-testid="action-report-event-details">
              <Flag className="h-[18px] w-[18px]" style={{ color: RED }} />
              Report this Event
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mx-auto w-full max-w-md px-5 py-6">
        {event.coverImage && (
          <img src={event.coverImage} alt="" className="mb-4 aspect-video w-full rounded-2xl object-cover" data-testid="img-event-details-cover" />
        )}

        <h1 className="text-2xl font-bold" data-testid="text-event-details-name">{event.title}</h1>
        {event.creatorName && (
          <div className="mt-1 text-sm text-muted-foreground">Organized by {event.creatorName}</div>
        )}

        <div className="mt-4 space-y-2 rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span data-testid="text-event-details-date">{dateLabel}</span>
          </div>
          {event.startTime && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-event-details-time">
                {event.startTime}{event.endTime ? ` – ${event.endTime}` : ""}
              </span>
            </div>
          )}
          {(event.locationName || event.locationTbd) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-event-details-location">{event.locationTbd ? "Location TBD" : event.locationName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span data-testid="text-event-details-attendees">
              {goingCount} going{event.attendeeLimit ? ` · ${event.attendeeLimit} spots` : ""}
            </span>
          </div>
        </div>

        {event.description && (
          <p className="mt-4 text-sm leading-relaxed text-foreground/80" data-testid="text-event-details-description">
            {event.description}
          </p>
        )}

        <VolunteerTasks eventId={id!} canManage={isOrganizer} />
        <Participants attendees={attendeeList} />

        <div className="mt-6">
          {!user ? (
            <button
              onClick={() => navigate("/auth")}
              className="h-12 w-full rounded-full text-base font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${BLUE}, #6C63FF)` }}
              data-testid="button-event-rsvp-signin"
            >
              Sign in to RSVP
            </button>
          ) : isGoing ? (
            <button
              onClick={() => cancelRsvpMutation.mutate()}
              disabled={cancelRsvpMutation.isPending}
              className="h-12 w-full rounded-full border border-red-400/60 bg-white text-base font-semibold text-red-500 disabled:opacity-60"
              data-testid="button-event-cancel-rsvp"
            >
              {cancelRsvpMutation.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Cancel RSVP — Going"}
            </button>
          ) : isWaitlisted ? (
            <button
              onClick={() => cancelRsvpMutation.mutate()}
              disabled={cancelRsvpMutation.isPending}
              className="h-12 w-full rounded-full border border-amber-400/60 bg-white text-base font-semibold text-amber-600 disabled:opacity-60"
              data-testid="button-event-cancel-waitlist"
            >
              {cancelRsvpMutation.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Leave Waitlist"}
            </button>
          ) : (
            <button
              onClick={() => rsvpMutation.mutate()}
              disabled={rsvpMutation.isPending}
              className="h-12 w-full rounded-full text-base font-semibold text-white disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${BLUE}, #6C63FF)` }}
              data-testid="button-event-rsvp"
            >
              {rsvpMutation.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "RSVP — I'm Going"}
            </button>
          )}
        </div>

        {isOrganizer && (
          <button
            onClick={() => navigate(`/bubble/${event.bubbleId}`)}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-semibold"
            data-testid="button-view-bubble-from-event"
          >
            <Crown className="h-4 w-4" style={{ color: BLUE }} />
            View Bubble
          </button>
        )}
      </div>

      <ReportEventModal open={reportOpen} onClose={() => setReportOpen(false)} eventId={id!} bubbleId={event.bubbleId} />
    </div>
  );
}
