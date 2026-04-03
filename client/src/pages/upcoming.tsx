import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

function formatEventDate(dateStr: string) {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "EEE, MMM d");
  } catch {
    return dateStr;
  }
}

function EventCard({ event }: { event: any }) {
  const [, navigate] = useLocation();
  const dateLabel = formatEventDate(event.date);

  return (
    <button
      onClick={() => navigate(`/bubble/${event.bubbleId}`)}
      className="w-full text-left"
      data-testid={`card-event-${event.id}`}
    >
      <div className="flex gap-4 rounded-2xl bg-white/60 p-4 ring-1 ring-black/5 transition hover:bg-white/80">
        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 py-3 text-[hsl(var(--primary))]">
          <CalendarDays className="h-4 w-4" />
          <div className="mt-1 text-center text-[10px] font-bold leading-tight">{dateLabel}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold" data-testid={`text-event-title-${event.id}`}>
            {event.title}
          </div>
          {event.bubbleName && (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[hsl(var(--primary))]">
              <Users className="h-3 w-3" />
              <span className="truncate">{event.bubbleName}</span>
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {event.startTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {event.startTime}
              </span>
            )}
            {event.locationName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{event.locationName}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Upcoming() {
  const { data: myEvents, isLoading: loadingMy } = useQuery<any[]>({
    queryKey: ["/api/events/my"],
    queryFn: () => apiRequest("GET", "/api/events/my").then((r) => r.json()),
  });

  const { data: publicEvents, isLoading: loadingPublic } = useQuery<any[]>({
    queryKey: ["/api/events/upcoming"],
    queryFn: () => fetch("/api/events/upcoming").then((r) => r.json()),
  });

  const isLoading = loadingMy || loadingPublic;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingMyEvents = (myEvents ?? []).filter((e) => {
    try {
      return parseISO(e.date) >= today;
    } catch {
      return true;
    }
  });

  const otherEvents = (publicEvents ?? []).filter((e) => {
    const alreadyIn = upcomingMyEvents.some((me) => me.id === e.id);
    return !alreadyIn;
  });

  return (
    <AppShell active="upcoming">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:pb-8">
        <div className="mb-6">
          <h1 className="font-display text-[24px] font-bold tracking-tight">Upcoming</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Events you're attending and new ones nearby</p>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Loading events…</div>
        ) : (
          <>
            {upcomingMyEvents.length > 0 && (
              <section className="mb-8">
                <div className="mb-3 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                  Your RSVPs
                </div>
                <div className="space-y-3">
                  {upcomingMyEvents.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              </section>
            )}

            {otherEvents.length > 0 && (
              <section>
                <div className="mb-3 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                  Happening Nearby
                </div>
                <div className="space-y-3">
                  {otherEvents.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              </section>
            )}

            {upcomingMyEvents.length === 0 && otherEvents.length === 0 && (
              <div className="rounded-2xl border border-black/8 bg-white/60 p-8 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <div className="mt-3 text-[14px] font-semibold">No upcoming events</div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  Join bubbles and RSVP to events to see them here.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
