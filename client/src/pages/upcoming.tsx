import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Clock, MapPin, Users, Send, Crown, Flag, MoreHorizontal,
  Plus, Check,
} from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
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
import { cn } from "@/lib/utils";

const BLUE = "#35A8F7";
const RED = "#E8453C";

function formatEventDate(dateStr: string) {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return { short: "Today", full: "Today" };
    if (isTomorrow(d)) return { short: "Tomorrow", full: "Tomorrow" };
    return { short: format(d, "MMM d"), full: format(d, "EEE, MMM d") };
  } catch {
    return { short: dateStr, full: dateStr };
  }
}

function ReportModal({
  open,
  onClose,
  title,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
}) {
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  const submit = () => {
    if (!reason.trim()) return;
    setSent(true);
    setTimeout(() => { onClose(); setSent(false); setReason(""); }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Describe the issue and our team will review it.
          </DialogDescription>
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
            />
            <button
              onClick={submit}
              className="h-11 w-full rounded-2xl text-[14px] font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${BLUE}, #6C63FF)` }}
            >
              Submit Report
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventKebabMenu({ event, isOrganizer }: { event: any; isOrganizer?: boolean }) {
  const [, navigate] = useLocation();
  const [reportConcern, setReportConcern] = useState(false);
  const [reportEvent, setReportEvent] = useState(false);

  const shareEvent = () => {
    const url = `${window.location.origin}/bubble/${event.bubbleId}`;
    if (navigator.share) {
      navigator.share({ title: event.title, url });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/80 backdrop-blur-sm shadow-sm ring-1 ring-black/10"
            data-testid={`button-event-kebab-${event.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4 text-black/70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 rounded-2xl border-0 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.14)]"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-normal text-black"
            onClick={shareEvent}
            data-testid={`action-share-event-${event.id}`}
          >
            <Send className="h-[18px] w-[18px] text-black/60" />
            Share Event
          </DropdownMenuItem>

          {isOrganizer && (
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-normal"
              style={{ color: BLUE }}
              onClick={() => navigate(`/bubble/${event.bubbleId}`)}
              data-testid={`action-manage-event-${event.id}`}
            >
              <Crown className="h-[18px] w-[18px]" style={{ color: BLUE }} />
              Manage Event
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="my-1 bg-black/6" />

          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-normal text-black"
            onClick={() => setReportConcern(true)}
            data-testid={`action-report-concern-event-${event.id}`}
          >
            <Flag className="h-[18px] w-[18px]" style={{ color: RED }} />
            Report a Concern
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-black/6" />

          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-normal"
            style={{ color: RED }}
            onClick={() => setReportEvent(true)}
            data-testid={`action-report-event-${event.id}`}
          >
            <Flag className="h-[18px] w-[18px]" style={{ color: RED }} />
            Report this Event
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportModal
        open={reportConcern}
        onClose={() => setReportConcern(false)}
        title="Report a Concern"
      />
      <ReportModal
        open={reportEvent}
        onClose={() => setReportEvent(false)}
        title="Report this Event"
      />
    </>
  );
}

function EventCard({ event, userId }: { event: any; userId?: string }) {
  const [, navigate] = useLocation();
  const { short, full } = formatEventDate(event.date);
  const coverImage = event.coverImage || event.bubble?.coverImage || null;
  const isSpecialDate = full === "Today" || full === "Tomorrow";
  const isOrganizer = event.createdBy === userId || event.bubble?.adminIds?.includes(userId);

  return (
    <div className="relative w-full" data-testid={`card-event-${event.id}`}>
      <button
        className="w-full text-left"
        onClick={() => navigate(`/bubble/${event.bubbleId}`)}
      >
        {/* Image */}
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-black/5">
          {coverImage ? (
            <img
              src={coverImage}
              alt={event.title}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              data-testid={`img-event-${event.id}`}
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-2"
              style={{ backgroundColor: "#EEF6FE" }}
            >
              <CalendarDays className="h-10 w-10 text-[#35A8F7]/50" />
            </div>
          )}

          {/* Date badge — top left */}
          <div
            className={cn(
              "absolute left-3 top-3 flex flex-col items-center rounded-xl px-2.5 py-1.5 text-center shadow-sm backdrop-blur-sm",
              isSpecialDate ? "text-white" : "bg-white/90 text-black/75",
            )}
            style={isSpecialDate ? { background: "linear-gradient(135deg, #35A8F7, #6C63FF)" } : {}}
          >
            <span className="text-[11px] font-bold leading-tight">{short}</span>
          </div>

          {/* Attendees chip */}
          {event.attendees != null && event.attendees > 0 && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              <Users className="h-3 w-3" />
              {event.attendees}
            </div>
          )}

          {/* Kebab */}
          <EventKebabMenu event={event} isOrganizer={isOrganizer} />
        </div>

        {/* Info below image */}
        <div className="mt-2.5 space-y-0.5 px-0.5">
          <div
            className="truncate text-[14px] font-semibold text-black"
            data-testid={`text-event-title-${event.id}`}
          >
            {event.title}
          </div>
          {(event.bubble?.title || event.bubbleName) && (
            <div className="text-[12px] font-semibold" style={{ color: BLUE }}>
              {event.bubble?.title || event.bubbleName}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5 text-[11px] text-black/45">
            {event.startTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {event.startTime}
              </span>
            )}
            {(event.locationName || event.locationAddress) && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{event.locationName || event.locationAddress}</span>
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <h2 className="text-[20px] font-bold text-black">{title}</h2>
      {count != null && count > 0 && (
        <span className="rounded-full bg-black/6 px-2.5 py-0.5 text-[12px] font-semibold text-black/50">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-white p-8 text-center shadow-[0_1px_6px_rgba(0,0,0,0.07)] ring-1 ring-black/5">
      <CalendarDays className="mx-auto h-8 w-8 text-black/15" />
      <div className="mt-3 text-[14px] font-semibold text-black/50">{message}</div>
      <div className="mt-1 text-[12px] text-black/35">{sub}</div>
    </div>
  );
}

export default function Upcoming() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: myEvents, isLoading: myLoading } = useQuery<any[]>({
    queryKey: ["/api/events/my"],
    queryFn: () => apiRequest("GET", "/api/events/my").then((r) => r.json()),
    enabled: !!user,
  });

  const { data: upcomingEvents, isLoading: upcomingLoading } = useQuery<any[]>({
    queryKey: ["/api/events/upcoming"],
    queryFn: () => fetch("/api/events/upcoming").then((r) => r.json()),
  });

  const rsvpd = (myEvents ?? []).filter(
    (e) => new Date(e.date) >= new Date(new Date().toDateString()),
  );
  const nearby = (upcomingEvents ?? []).filter(
    (e) => !rsvpd.find((m: any) => m.id === e.id),
  );

  const isLoading = myLoading || upcomingLoading;

  return (
    <AppShell active="upcoming">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[28px] font-bold text-black">Upcoming</h1>
          <button
            onClick={() => navigate("/create-event")}
            className="flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${BLUE}, #6C63FF)` }}
            data-testid="button-create-event"
          >
            <Plus className="h-4 w-4" />
            Create Event
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="text-[13px] text-black/40">Loading events…</div>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Your RSVPs */}
            <section>
              <SectionHeader title="Your RSVPs" count={rsvpd.length} />
              {rsvpd.length === 0 ? (
                <EmptyState
                  message="No upcoming RSVPs"
                  sub="RSVP to events in your bubbles to see them here."
                />
              ) : (
                <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                  {rsvpd.map((e) => (
                    <EventCard key={e.id} event={e} userId={user?.id} />
                  ))}
                </div>
              )}
            </section>

            {/* Happening near you */}
            <section>
              <SectionHeader title="Happening near you" count={nearby.length} />
              {nearby.length === 0 ? (
                <EmptyState
                  message="No upcoming events"
                  sub="Check back soon for community events near you."
                />
              ) : (
                <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                  {nearby.map((e) => (
                    <EventCard key={e.id} event={e} userId={user?.id} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
