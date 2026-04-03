import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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

function EventCard({ event }: { event: any }) {
  const [, navigate] = useLocation();
  const { short, full } = formatEventDate(event.date);
  const coverImage = event.coverImage || event.bubble?.coverImage || null;
  const isSpecialDate = full === "Today" || full === "Tomorrow";

  return (
    <motion.button
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={() => navigate(`/bubble/${event.bubbleId}`)}
      className="w-full text-left"
      data-testid={`card-event-${event.id}`}
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
            style={{ background: "linear-gradient(135deg, #35A8F7/15 0%, #6C63FF/15 100%)", backgroundColor: "#EEF6FE" }}
          >
            <CalendarDays className="h-10 w-10 text-[#35A8F7]/50" />
          </div>
        )}

        {/* Date badge — top left */}
        <div
          className={cn(
            "absolute left-3 top-3 flex flex-col items-center rounded-xl px-2.5 py-1.5 text-center shadow-sm backdrop-blur-sm",
            isSpecialDate
              ? "text-white"
              : "bg-white/90 text-black/75",
          )}
          style={isSpecialDate ? { background: "linear-gradient(135deg, #35A8F7, #6C63FF)" } : {}}
        >
          <span className="text-[11px] font-bold leading-tight">{short}</span>
        </div>

        {/* RSVP chip if attendees */}
        {event.attendees != null && event.attendees > 0 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Users className="h-3 w-3" />
            {event.attendees}
          </div>
        )}
      </div>

      {/* Info below */}
      <div className="mt-2.5 space-y-0.5 px-0.5">
        <div
          className="truncate text-[14px] font-semibold text-black"
          data-testid={`text-event-title-${event.id}`}
        >
          {event.title}
        </div>
        {(event.bubble?.title || event.bubbleName) && (
          <div className="text-[12px] font-semibold text-[#35A8F7]">
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
    </motion.button>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <h2 className="text-[20px] font-bold text-black">{title}</h2>
      </div>
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
    (e) => !rsvpd.find((m: any) => m.id === e.id),
  );

  return (
    <AppShell active="upcoming">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <h1 className="mb-6 text-[28px] font-bold text-black">Upcoming</h1>

        <div className="space-y-12">
          {/* Your RSVPs */}
          <section>
            <SectionHeader title="Your RSVPs" count={rsvpd.length} />
            {rsvpd.length === 0 ? (
              <EmptyState
                message="No upcoming events"
                sub="RSVP to events in your bubbles to see them here."
              />
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {rsvpd.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </section>

          {/* Happening near you */}
          <section>
            <SectionHeader title="Happening near you" count={nearby.length} />
            {nearby.length === 0 ? (
              <EmptyState
                message="No events found"
                sub="Check back soon for community events near you."
              />
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {nearby.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
