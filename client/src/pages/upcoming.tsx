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

function DatePill({ label }: { label: string }) {
  const isSpecial = label === "Today" || label === "Tomorrow";
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded-xl px-3 py-2 text-center",
        isSpecial
          ? "bg-[#35A8F7] text-white"
          : "bg-black/6 text-black/70",
      )}
      style={{ minWidth: "52px" }}
    >
      <CalendarDays className="mb-0.5 h-3.5 w-3.5" />
      <span className="text-[10px] font-bold leading-tight">{label}</span>
    </div>
  );
}

function EventCard({ event }: { event: any }) {
  const [, navigate] = useLocation();
  const dateLabel = formatEventDate(event.date);

  return (
    <button
      onClick={() => navigate(`/bubble/${event.bubbleId}`)}
      className="group w-full text-left"
      data-testid={`card-event-${event.id}`}
    >
      <div className="flex gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.07)] ring-1 ring-black/5 transition hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
        <DatePill label={dateLabel} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="truncate text-[14px] font-semibold text-black" data-testid={`text-event-title-${event.id}`}>
              {event.title}
            </div>
          </div>
          {event.bubbleName && (
            <div className="mt-0.5 text-[12px] font-semibold text-[#35A8F7]">
              {event.bubbleName}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-black/45">
            {event.startTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{event.startTime}</span>
              </div>
            )}
            {(event.locationName || event.locationAddress) && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{event.locationName || event.locationAddress}</span>
              </div>
            )}
            {event.attendees != null && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{event.attendees} going</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <h2 className="text-[18px] font-bold text-black">{title}</h2>
      {count != null && count > 0 && (
        <span className="rounded-full bg-black/6 px-2.5 py-0.5 text-[12px] font-semibold text-black/50">
          {count}
        </span>
      )}
    </div>
  );
}

export default function Upcoming() {
  const { data: myEvents } = useQuery<any[]>({
    queryKey: ["/api/events/my"],
    queryFn: () => apiRequest("GET", "/api/events/my").then((r) => r.json()),
  });

  const { data: upcomingEvents } = useQuery<any[]>({
    queryKey: ["/api/events/upcoming"],
    queryFn: () => apiRequest("GET", "/api/events/upcoming").then((r) => r.json()),
  });

  const rsvpd = myEvents ?? [];
  const nearby = (upcomingEvents ?? []).filter(
    (e) => !rsvpd.find((m) => m.id === e.id),
  );

  return (
    <AppShell active="upcoming">
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <h1 className="mb-6 text-[28px] font-bold text-black">Upcoming</h1>

        <div className="space-y-10">
          {/* Your RSVPs */}
          <section>
            <SectionHeader title="Your RSVPs" count={rsvpd.length} />
            {rsvpd.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow-[0_1px_6px_rgba(0,0,0,0.07)] ring-1 ring-black/5">
                <CalendarDays className="mx-auto h-8 w-8 text-black/15" />
                <div className="mt-3 text-[14px] font-semibold text-black/50">No upcoming events</div>
                <div className="mt-1 text-[12px] text-black/35">
                  RSVP to events in your bubbles to see them here.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {rsvpd.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </section>

          {/* Nearby events */}
          <section>
            <SectionHeader title="Happening near you" count={nearby.length} />
            {nearby.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow-[0_1px_6px_rgba(0,0,0,0.07)] ring-1 ring-black/5">
                <CalendarDays className="mx-auto h-8 w-8 text-black/15" />
                <div className="mt-3 text-[14px] font-semibold text-black/50">No events found</div>
                <div className="mt-1 text-[12px] text-black/35">
                  Check back soon for community events near you.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {nearby.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
