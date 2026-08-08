import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Heart, MapPin, Plus, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { AppShell } from "@/components/AppShell";
import { CategorySidebar, type CategoryNode } from "@/components/CategorySidebar";
import { CampusBanner } from "@/components/CampusBanner";

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
function IconCalendarTab({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5.3077 20.5C4.8026 20.5 4.375 20.325 4.025 19.975C3.675 19.625 3.5 19.1974 3.5 18.6923V5.30776C3.5 4.80259 3.675 4.37499 4.025 4.02499C4.375 3.67499 4.8026 3.49999 5.3077 3.49999H6.6923V1.38477H8.2308V3.49999H15.8077V1.38477H17.3077V3.49999H18.6923C19.1974 3.49999 19.625 3.67499 19.975 4.02499C20.325 4.37499 20.5 4.80259 20.5 5.30776V18.6923C20.5 19.1974 20.325 19.625 19.975 19.975C19.625 20.325 19.1974 20.5 18.6923 20.5H5.3077ZM5.3077 19H18.6923C18.7692 19 18.8398 18.9679 18.9038 18.9038C18.9679 18.8398 19 18.7693 19 18.6923V9.30776H5V18.6923C5 18.7693 5.0321 18.8398 5.0963 18.9038C5.1603 18.9679 5.2307 19 5.3077 19ZM5 7.80776H19V5.30776C19 5.23076 18.9679 5.16026 18.9038 5.09626C18.8398 5.03209 18.7692 4.99999 18.6923 4.99999H5.3077C5.2307 4.99999 5.1603 5.03209 5.0963 5.09626C5.0321 5.16026 5 5.23076 5 5.30776V7.80776Z" fill={color} />
    </svg>
  );
}

/* ─── Legacy mobile-only category chips (unchanged, md:hidden fallback) ─── */
const LEGACY_CHIPS = [
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
const LEGACY_CATEGORY_MAP: Record<string, string[]> = {
  active:    ["Active", "Running", "Cycling", "Hiking", "Tennis", "Pickleball", "Yoga", "Sports"],
  creative:  ["Creative", "Arts & Crafts", "Photography", "Music", "Writing"],
  food:      ["Food & Social", "Food & Drink", "Cooking", "Coffee Meets", "Farmers Markets"],
  lifestyle: ["Lifestyle", "Wellness", "Gardening"],
  adventure: ["Adventure & Outdoors", "Adventure", "Hiking"],
  community: ["Community", "Neighborhood"],
  tech:      ["Tech & Professional", "Professional"],
  campus:    ["Campus"],
};

function LegacyCategoryChips({
  active,
  onChange,
}: {
  active: string;
  onChange: (id: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={rowRef} className="scrollbar-none flex gap-2 overflow-x-auto pb-1 md:hidden">
      {LEGACY_CHIPS.map((cat) => {
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
        {item.category && (
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-black/75 shadow-sm backdrop-blur-sm" data-testid={`tag-bubble-${item.id}`}>
            {item.category}
          </div>
        )}
        {item.privacy && item.privacy !== "Public" && (
          <div className="absolute right-3 top-11 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-black/75 shadow-sm backdrop-blur-sm">
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

/* ─── Event card (wider — image left, details right) ────────────── */
function EventCard({ event, onClick }: { event: any; onClick: () => void }) {
  const dateStr = event.date
    ? new Date(event.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <motion.button
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={onClick}
      className="flex w-full items-stretch gap-4 rounded-2xl bg-white p-2 text-left ring-1 ring-black/5"
      data-testid={`card-event-${event.id}`}
    >
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-black/5">
        {event.coverImage || event.images?.[0] ? (
          <img
            src={event.coverImage || event.images?.[0]}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#35A8F7]/15 to-[#6C63FF]/15">
            <IconCalendarTab size={28} color="rgba(53,168,247,0.4)" />
          </div>
        )}
        {event.category && (
          <div className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-bold text-black/75 shadow-sm backdrop-blur-sm">
            {event.category}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-1">
        {dateStr && (
          <div className="flex items-center gap-1 text-[11px] font-semibold text-[#35A8F7]">
            <IconCalendarTab size={12} color="#35A8F7" />{dateStr}
          </div>
        )}
        <div className="truncate text-[15px] font-semibold text-black">{event.title}</div>
        {event.description && (
          <div className="line-clamp-2 text-[12.5px] text-black/55">{event.description}</div>
        )}
      </div>
    </motion.button>
  );
}

/* ─── Section header ─────────────────────────────── */
function SectionHeader({
  title,
  subtitle,
  onViewAll,
  showViewAll,
}: {
  title: string;
  subtitle?: string;
  onViewAll?: () => void;
  showViewAll?: boolean;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[20px] font-bold text-black">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-black/50">{subtitle}</p>}
      </div>
      {showViewAll && (
        <button
          onClick={onViewAll}
          className="shrink-0 text-[13px] font-semibold text-[#35A8F7] hover:underline"
          data-testid={`button-view-all-${title.toLowerCase().replace(/\s+/g, "-")}`}
        >
          View all →
        </button>
      )}
    </div>
  );
}

/* ─── Category matching against the free-text bubble.category field ── */
function nodeMatches(categoryText: string, node: CategoryNode): boolean {
  const text = categoryText.toLowerCase();
  const name = (node.displayName || node.name).toLowerCase();
  if (text === name) return true;
  return (node.children ?? []).some((c) => text === (c.displayName || c.name).toLowerCase());
}

/* ─── Page ───────────────────────────────────────── */
export default function Explore() {
  const [, navigate] = useLocation();
  const urlSearch = useSearch();
  const searchQuery = useMemo(() => new URLSearchParams(urlSearch).get("q") ?? "", [urlSearch]);

  const [legacyChip, setLegacyChip] = useState("all");
  const [selectedNode, setSelectedNode] = useState<CategoryNode | "all">("all");
  const [showAllBubbles, setShowAllBubbles] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);

  useEffect(() => {
    setShowAllBubbles(false);
    setShowAllEvents(false);
  }, [legacyChip, selectedNode, searchQuery]);

  /* Categories (real, nested) */
  const { data: categories } = useQuery<CategoryNode[]>({
    queryKey: ["/api/categories"],
    queryFn: () => fetch("/api/categories").then((r) => r.json()),
  });

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

  const matchesCategory = (categoryText: string) => {
    if (selectedNode !== "all") return nodeMatches(categoryText, selectedNode);
    if (legacyChip !== "all") {
      return (LEGACY_CATEGORY_MAP[legacyChip] ?? []).some((cat) =>
        categoryText.toLowerCase().includes(cat.toLowerCase()),
      );
    }
    return true;
  };

  const filteredBubbles = allBubbles
    .filter((b) => matchesCategory(b.category))
    .filter((b) =>
      !searchQuery ||
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.tagline.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const filteredEvents = allEvents
    .filter((e) => matchesCategory(e.category ?? e.bubble?.category ?? ""))
    .filter((e) =>
      !searchQuery ||
      e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.locationName?.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  // "Trending" = mobile's actual signal: the default server sort, unmodified
  // (bubbles: createdAt DESC, events: soonest date first) — first N shown,
  // "View all" reveals the rest of the same already-fetched, already-filtered list.
  const trendingBubbles = showAllBubbles ? filteredBubbles : filteredBubbles.slice(0, 4);
  const trendingEvents = showAllEvents ? filteredEvents : filteredEvents.slice(0, 2);

  const handleLegacyChip = (id: string) => { setLegacyChip(id); setSelectedNode("all"); };
  const handleSidebarSelect = (node: CategoryNode | "all") => { setSelectedNode(node); setLegacyChip("all"); };

  return (
    <AppShell active="explore">
      <div className="pb-6">
        <div className="flex min-h-[calc(100dvh-68px)]">
          <CategorySidebar
            categories={categories ?? []}
            selectedId={selectedNode === "all" ? "all" : selectedNode.id}
            onSelect={handleSidebarSelect}
          />

          <div className="hidden shrink-0 self-stretch border-l border-black/8 md:block" aria-hidden="true" />

          <div className="min-w-0 flex-1 px-4 pt-6 md:pl-8 md:pr-6">
            <CampusBanner />

            <div className="mb-6">
              <LegacyCategoryChips active={legacyChip} onChange={handleLegacyChip} />
            </div>

            {bubblesLoading || eventsLoading ? (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-2.5">
                    <div className="aspect-square animate-pulse rounded-2xl bg-black/8" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-black/8" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-black/5" />
                  </div>
                ))}
              </div>
            ) : filteredBubbles.length === 0 && filteredEvents.length === 0 ? (
              <div className="py-20 text-center">
                <Users className="mx-auto h-10 w-10 text-black/15" />
                <div className="mt-4 text-[15px] font-semibold text-black/50">Nothing found</div>
                <div className="mt-1 text-[13px] text-black/35">Try a different search or category</div>
              </div>
            ) : (
              <div className="space-y-12">
                {filteredBubbles.length > 0 && (
                  <section>
                    <SectionHeader
                      title="Trending Bubbles"
                      subtitle="Communities to discover right now"
                      showViewAll={!showAllBubbles && filteredBubbles.length > 4}
                      onViewAll={() => setShowAllBubbles(true)}
                    />
                    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {trendingBubbles.map((b) => (
                        <BubbleCard key={b.id} item={b} onOpen={(id) => navigate(`/bubble/${id}`)} />
                      ))}
                    </div>
                  </section>
                )}

                {filteredEvents.length > 0 && (
                  <section>
                    <SectionHeader
                      title="Trending Events"
                      subtitle="Happening soon"
                      showViewAll={!showAllEvents && filteredEvents.length > 2}
                      onViewAll={() => setShowAllEvents(true)}
                    />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {trendingEvents.map((e) => (
                        <EventCard
                          key={e.id}
                          event={e}
                          onClick={() => navigate(`/bubble/${e.bubbleId}`)}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAB — mobile create */}
      <button
        onClick={() => navigate("/create")}
        className="fixed bottom-24 right-5 grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_4px_24px_rgba(53,168,247,0.45)] transition-transform hover:scale-105 md:hidden"
        style={{ background: "#35A8F7" }}
        data-testid="button-fab-create"
      >
        <Plus className="h-6 w-6" />
      </button>
    </AppShell>
  );
}
