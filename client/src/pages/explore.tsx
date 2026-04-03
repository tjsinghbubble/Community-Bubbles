import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Heart, MapPin, Plus, Search, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { AppShell } from "@/components/AppShell";

/* ─── Types ─────────────────────────────────────── */
type BubbleItem = {
  id: string;
  category: string;
  title: string;
  tagline: string;
  members: number;
  miles: string;
  image: string;
  privacy: string;
};

/* ─── Icons matching mobile app exactly ──────────── */
function IconBubblesTab({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="-3 0 24 24" fill="none">
      <path d="M14.007 2C12.285 2.001 10.634 2.6859 9.416 3.9026C8.199 5.1204 7.514 6.7715 7.513 8.4935C7.871 17.1183 20.143 17.1183 20.5 8.4935C20.499 6.7715 19.814 5.1205 18.597 3.9026C17.38 2.6859 15.729 2.001 14.007 2ZM14.007 14.1653C12.503 14.1643 11.061 13.5667 9.997 12.503C8.933 11.4392 8.336 9.9976 8.335 8.4933C8.647 0.969 19.367 0.969 19.679 8.4933C19.677 9.9966 19.078 11.4381 18.015 12.5019C16.952 13.5646 15.51 14.1633 14.007 14.1653Z" fill={color} stroke={color} strokeWidth={0.4} />
      <path d="M14.007 4.6245C13.596 4.6245 12.865 4.5916 12.939 5.1749C12.959 5.2827 13.023 5.3771 13.113 5.4377C13.205 5.4993 13.316 5.5209 13.423 5.4993C14.5 5.296 15.602 5.6831 16.314 6.5159C17.025 7.3476 17.237 8.4976 16.869 9.5285C16.822 9.6548 16.84 9.7964 16.917 9.9073C16.994 10.0172 17.121 10.0829 17.255 10.0829C17.428 10.0829 17.583 9.9741 17.641 9.8119C18.074 8.6249 17.9 7.3014 17.177 6.2654C16.454 5.2294 15.271 4.6112 14.007 4.6082L14.007 4.6245Z" fill={color} stroke={color} strokeWidth={0.4} />
      <path d="M2.203 9.0601C0.956 9.0621 -0.239 9.558 -1.12 10.4401C-2.002 11.3211 -2.498 12.5162 -2.5 13.7628C-2.241 20.0015 6.647 20.0015 6.905 13.7628C6.903 12.5163 6.407 11.3211 5.525 10.4401C4.644 9.558 3.449 9.0621 2.203 9.0601H2.203ZM2.203 17.6439C1.174 17.6429 0.187 17.2332 -0.541 16.5063C-1.268 15.7783 -1.678 14.7915 -1.679 13.7626C-1.469 8.6163 5.874 8.6205 6.084 13.7626C6.083 14.7914 5.673 15.7782 4.946 16.5063C4.218 17.2332 3.231 17.6429 2.202 17.6439H2.203Z" fill={color} stroke={color} strokeWidth={0.4} />
      <path d="M1.369 11.1468C0.227 11.5061 -0.548 12.5658 -0.545 13.763C-0.545 14.1162 -0.545 14.7077 -0.073 14.7159C0.055 14.7189 0.177 14.6635 0.257 14.5639C0.337 14.4653 0.368 14.3349 0.338 14.2107C0.302 14.0638 0.284 13.9139 0.285 13.763C0.28 12.9292 0.815 12.1889 1.607 11.9312C1.811 11.8552 1.919 11.6345 1.857 11.427C1.794 11.2196 1.581 11.0964 1.369 11.1468Z" fill={color} stroke={color} strokeWidth={0.4} />
      <path d="M8.674 18.2406C8.259 18.4454 8.032 18.7961 8.112 19.1063C8.135 19.1979 8.174 19.3513 8.356 19.3073C8.405 19.2956 8.448 19.2693 8.473 19.2356C8.497 19.2022 8.5 19.1654 8.48 19.1361C8.457 19.1015 8.44 19.0644 8.43 19.0252C8.373 18.8094 8.53 18.5651 8.817 18.4207C8.89 18.3811 8.917 18.3132 8.879 18.2656C8.842 18.2179 8.752 18.2068 8.674 18.2406Z" fill={color} stroke={color} strokeWidth={0.4} />
      <path d="M9.986 16.0671C8.125 16.0692 6.618 17.5786 6.618 19.4391C6.786 23.8995 13.189 23.8995 13.358 19.4391C13.356 17.5775 11.847 16.0692 9.986 16.0671ZM9.986 21.9856C8.58 21.9836 7.441 20.8449 7.439 19.4392C7.558 16.0673 12.417 16.0673 12.536 19.4392C12.534 20.8459 11.392 21.9856 9.986 21.9856Z" fill={color} stroke={color} strokeWidth={0.4} />
    </svg>
  );
}

function IconCalendarTab({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5.3077 20.5C4.8026 20.5 4.375 20.325 4.025 19.975C3.675 19.625 3.5 19.1974 3.5 18.6923V5.30776C3.5 4.80259 3.675 4.37499 4.025 4.02499C4.375 3.67499 4.8026 3.49999 5.3077 3.49999H6.6923V1.38477H8.2308V3.49999H15.8077V1.38477H17.3077V3.49999H18.6923C19.1974 3.49999 19.625 3.67499 19.975 4.02499C20.325 4.37499 20.5 4.80259 20.5 5.30776V18.6923C20.5 19.1974 20.325 19.625 19.975 19.975C19.625 20.325 19.1974 20.5 18.6923 20.5H5.3077ZM5.3077 19H18.6923C18.7692 19 18.8398 18.9679 18.9038 18.9038C18.9679 18.8398 19 18.7693 19 18.6923V9.30776H5V18.6923C5 18.7693 5.0321 18.8398 5.0963 18.9038C5.1603 18.9679 5.2307 19 5.3077 19ZM5 7.80776H19V5.30776C19 5.23076 18.9679 5.16026 18.9038 5.09626C18.8398 5.03209 18.7692 4.99999 18.6923 4.99999H5.3077C5.2307 4.99999 5.1603 5.03209 5.0963 5.09626C5.0321 5.16026 5 5.23076 5 5.30776V7.80776Z" fill={color} />
    </svg>
  );
}

/* ─── Tabs for AppShell centerContent ────────────── */
function ExploreTabs({
  active,
  onChange,
}: {
  active: "bubbles" | "events";
  onChange: (t: "bubbles" | "events") => void;
}) {
  const tabs = [
    { id: "bubbles" as const, label: "Bubbles", Icon: IconBubblesTab },
    { id: "events"  as const, label: "Events",  Icon: IconCalendarTab },
  ];
  return (
    <div className="flex h-full items-end justify-center gap-6">
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              "flex flex-col items-center gap-1 pb-1 border-b-2 transition-all",
              isActive
                ? "border-black text-black"
                : "border-transparent text-black/45 hover:text-black/70",
            )}
            data-testid={`tab-explore-${id}`}
          >
            <Icon size={22} color={isActive ? "#111" : "rgba(0,0,0,0.4)"} />
            <span className="text-[12px] font-semibold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Category chips ─────────────────────────────── */
const CATEGORIES = [
  { id: "all",       label: "All",                emoji: "✨" },
  { id: "active",    label: "Active",             emoji: "🏃" },
  { id: "creative",  label: "Creative",           emoji: "🎨" },
  { id: "food",      label: "Food & Social",      emoji: "🍕" },
  { id: "lifestyle", label: "Lifestyle",          emoji: "🌿" },
  { id: "adventure", label: "Adventure",          emoji: "🏔️" },
  { id: "community", label: "Community",          emoji: "🤝" },
  { id: "tech",      label: "Tech & Professional",emoji: "💼" },
  { id: "campus",    label: "Campus",             emoji: "🎓" },
];

function CategoryChips({
  active,
  onChange,
}: {
  active: string;
  onChange: (id: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={rowRef} className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={cn(
              "flex shrink-0 flex-col items-center gap-1 rounded-xl px-4 py-2.5 text-center transition-all",
              isActive
                ? "border-b-2 border-[#35A8F7] text-[#35A8F7]"
                : "text-black/50 hover:text-black/75",
            )}
            data-testid={`chip-${cat.id}`}
          >
            <span className="text-[22px] leading-none">{cat.emoji}</span>
            <span className="whitespace-nowrap text-[11px] font-semibold">{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Bubble card ────────────────────────────────── */
function BubbleCard({
  item,
  onOpen,
}: {
  item: BubbleItem;
  onOpen: (id: string) => void;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <motion.button
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={() => onOpen(item.id)}
      className="w-full text-left"
      data-testid={`card-bubble-${item.id}`}
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-black/5">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            data-testid={`img-bubble-${item.id}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#35A8F7]/20 to-[#6C63FF]/20">
            <Users className="h-10 w-10 text-[#35A8F7]/40" />
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setSaved(!saved); }}
          className="absolute right-3 top-3 transition-transform hover:scale-110"
          data-testid={`button-save-${item.id}`}
        >
          <Heart className={cn("h-6 w-6 drop-shadow-md transition-colors", saved ? "fill-[#35A8F7] text-[#35A8F7]" : "fill-white/30 text-white")} />
        </button>
        {item.privacy && item.privacy !== "Public" && (
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-black/75 shadow-sm backdrop-blur-sm">
            {item.privacy === "Request" ? "Request to join" : item.privacy}
          </div>
        )}
      </div>
      <div className="mt-2.5 space-y-0.5 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate text-[14px] font-semibold text-black" data-testid={`text-bubble-title-${item.id}`}>
            {item.title}
          </div>
          {item.members > 0 && (
            <div className="shrink-0 text-[12px] font-semibold text-black/70 flex items-center gap-1">
              <Users className="h-3 w-3" />{item.members}
            </div>
          )}
        </div>
        {item.category && <div className="text-[12px] font-semibold text-[#35A8F7]">{item.category}</div>}
        {item.tagline && <div className="line-clamp-1 text-[12px] text-black/55">{item.tagline}</div>}
        {item.miles && (
          <div className="flex items-center gap-1 pt-0.5 text-[12px] text-black/40">
            <MapPin className="h-3 w-3" />{item.miles}
          </div>
        )}
      </div>
    </motion.button>
  );
}

/* ─── Event card ─────────────────────────────────── */
function EventCard({ event, onClick }: { event: any; onClick: () => void }) {
  const dateStr = event.date
    ? new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })
    : "";

  return (
    <motion.button
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={onClick}
      className="w-full text-left"
      data-testid={`card-event-${event.id}`}
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-black/5">
        {event.coverImage || event.images?.[0] ? (
          <img
            src={event.coverImage || event.images?.[0]}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#35A8F7]/15 to-[#6C63FF]/15">
            <IconCalendarTab size={36} color="rgba(53,168,247,0.4)" />
          </div>
        )}
        {dateStr && (
          <div className="absolute left-3 top-3 rounded-xl bg-white/92 px-2.5 py-1 text-center shadow-sm backdrop-blur-sm">
            <div className="text-[10px] font-bold text-[#35A8F7] uppercase leading-none">{dateStr.split(",")[0]}</div>
            <div className="text-[11px] font-bold text-black/80 leading-none mt-0.5">{dateStr.split(",")[1]?.trim()}</div>
          </div>
        )}
      </div>
      <div className="mt-2.5 space-y-0.5 px-0.5">
        <div className="truncate text-[14px] font-semibold text-black">{event.title}</div>
        {event.bubble?.title && <div className="text-[12px] font-semibold text-[#35A8F7]">{event.bubble.title}</div>}
        {event.locationName && (
          <div className="flex items-center gap-1 text-[12px] text-black/50">
            <MapPin className="h-3 w-3" />{event.locationName}
          </div>
        )}
        {event.startTime && (
          <div className="text-[12px] text-black/40">{event.startTime}</div>
        )}
      </div>
    </motion.button>
  );
}

/* ─── Section header ─────────────────────────────── */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[20px] font-bold text-black">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[13px] text-black/50">{subtitle}</p>}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────── */
export default function Explore() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab]         = useState<"bubbles" | "events">("bubbles");
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery]     = useState("");

  /* Bubbles data */
  const { data: rawBubbles, isLoading: bubblesLoading } = useQuery<any[]>({
    queryKey: ["/api/bubbles"],
    queryFn: () => fetch("/api/bubbles").then((r) => r.json()),
  });

  /* Events data */
  const { data: rawEvents, isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: ["/api/events"],
    queryFn: () => fetch("/api/events").then((r) => r.json()),
  });

  const allBubbles: BubbleItem[] = (rawBubbles ?? []).map((b: any) => ({
    id: b.id,
    category: b.category ?? "",
    title: b.title ?? "",
    tagline: b.tagline ?? "",
    members: b.members ?? 0,
    miles: b.distance ?? "",
    image: b.images?.[0] || b.coverImage || "",
    privacy: b.privacy ?? "Public",
  }));

  const allEvents: any[] = (rawEvents ?? []).filter((e: any) => {
    const eventDate = new Date(e.date);
    return eventDate >= new Date(Date.now() - 86400000); // today or future
  });

  /* Category filter */
  const categoryMap: Record<string, string[]> = {
    active:    ["Active", "Running", "Cycling", "Hiking", "Tennis", "Pickleball", "Yoga", "Sports"],
    creative:  ["Creative", "Arts & Crafts", "Photography", "Music", "Writing"],
    food:      ["Food & Social", "Food & Drink", "Cooking", "Coffee Meets", "Farmers Markets"],
    lifestyle: ["Lifestyle", "Wellness", "Gardening"],
    adventure: ["Adventure & Outdoors", "Adventure", "Hiking"],
    community: ["Community", "Neighborhood"],
    tech:      ["Tech & Professional", "Professional"],
    campus:    ["Campus"],
  };

  const filteredBubbles = (
    activeCategory === "all"
      ? allBubbles
      : allBubbles.filter((b) =>
          (categoryMap[activeCategory] ?? []).some((cat) =>
            b.category.toLowerCase().includes(cat.toLowerCase()),
          ),
        )
  ).filter((b) =>
    !searchQuery ||
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.tagline.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredEvents = allEvents.filter((e) =>
    !searchQuery ||
    e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.locationName?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const popular = filteredBubbles.slice(0, 8);
  const newer   = filteredBubbles.slice(8, 16);

  const centerContent = (
    <ExploreTabs active={activeTab} onChange={(t) => { setActiveTab(t); setSearchQuery(""); }} />
  );

  return (
    <AppShell active="explore" centerContent={centerContent}>

      {/* ── Mobile tabs (shown in content area on small screens) ── */}
      <div className="md:hidden border-b border-black/8 bg-white">
        <div className="flex justify-center gap-8 px-4">
          {(["bubbles", "events"] as const).map((id) => {
            const isActive = activeTab === id;
            const Icon = id === "bubbles" ? IconBubblesTab : IconCalendarTab;
            return (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setSearchQuery(""); }}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 border-b-2 transition-all",
                  isActive ? "border-black text-black" : "border-transparent text-black/45",
                )}
                data-testid={`tab-mobile-${id}`}
              >
                <Icon size={22} color={isActive ? "#111" : "rgba(0,0,0,0.4)"} />
                <span className="text-[11px] font-semibold capitalize">{id}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">

        {/* ── Simple search bar ── */}
        <div className="mb-6 flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.07)] focus-within:shadow-[0_2px_18px_rgba(0,0,0,0.12)] transition-shadow">
          <Search className="h-4 w-4 shrink-0 text-black/35" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === "bubbles" ? "Search bubbles..." : "Search events..."}
            className="flex-1 bg-transparent text-[14px] text-black placeholder:text-black/35 focus:outline-none"
            data-testid="search-main"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="shrink-0 text-[11px] font-semibold text-black/40 hover:text-black/70"
            >
              ✕
            </button>
          )}
        </div>

        {/* ── Bubbles tab ── */}
        {activeTab === "bubbles" && (
          <>
            {/* Category chips */}
            <div className="mb-8 border-b border-black/6 pb-1">
              <CategoryChips active={activeCategory} onChange={setActiveCategory} />
            </div>

            {bubblesLoading ? (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-2.5">
                    <div className="aspect-square animate-pulse rounded-2xl bg-black/8" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-black/8" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-black/5" />
                  </div>
                ))}
              </div>
            ) : filteredBubbles.length === 0 ? (
              <div className="py-20 text-center">
                <Users className="mx-auto h-10 w-10 text-black/15" />
                <div className="mt-4 text-[15px] font-semibold text-black/50">No bubbles found</div>
                <div className="mt-1 text-[13px] text-black/35">Try a different search or category</div>
              </div>
            ) : (
              <div className="space-y-12">
                <section>
                  <SectionHeader title="Popular near you" subtitle="The most active communities in your area" />
                  <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                    {popular.map((b) => (
                      <BubbleCard key={b.id} item={b} onOpen={(id) => navigate(`/bubble/${id}`)} />
                    ))}
                  </div>
                </section>
                {newer.length > 0 && (
                  <section>
                    <SectionHeader title="More to explore" subtitle="Discover communities you haven't seen yet" />
                    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                      {newer.map((b) => (
                        <BubbleCard key={b.id} item={b} onOpen={(id) => navigate(`/bubble/${id}`)} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Events tab ── */}
        {activeTab === "events" && (
          <>
            {eventsLoading ? (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-2.5">
                    <div className="aspect-square animate-pulse rounded-2xl bg-black/8" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-black/8" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-black/5" />
                  </div>
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="py-20 text-center">
                <IconCalendarTab size={40} color="rgba(0,0,0,0.15)" />
                <div className="mt-4 text-[15px] font-semibold text-black/50">No upcoming events found</div>
                <div className="mt-1 text-[13px] text-black/35">
                  {searchQuery ? "Try a different search" : "Check back soon or create one!"}
                </div>
              </div>
            ) : (
              <section>
                <SectionHeader title="Upcoming events" subtitle="Events happening near you" />
                <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredEvents.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      onClick={() => navigate(`/bubble/${e.bubbleId}`)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* FAB — mobile create */}
      <button
        onClick={() => navigate(activeTab === "events" ? "/create-event" : "/create")}
        className="fixed bottom-24 right-5 grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_4px_24px_rgba(53,168,247,0.45)] transition-transform hover:scale-105 md:hidden"
        style={{ background: "#35A8F7" }}
        data-testid="button-fab-create"
      >
        <Plus className="h-6 w-6" />
      </button>
    </AppShell>
  );
}
