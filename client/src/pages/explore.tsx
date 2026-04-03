import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, Heart, MapPin, Plus, Search, Users } from "lucide-react";

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
    <div
      ref={rowRef}
      className="scrollbar-none flex gap-2 overflow-x-auto pb-1"
    >
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

/* ─── Search pill + Create (Airbnb style) ────────── */
function SearchPill() {
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setShowCreate(false);
      }
    }
    if (showCreate) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showCreate]);

  return (
    <div className="flex items-center gap-2">
      {/* Search pill */}
      <div className="flex flex-1 items-center rounded-full border border-black/10 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_18px_rgba(0,0,0,0.14)] transition-shadow">
        <div className="flex flex-1 items-center divide-x divide-black/8">
          <div className="px-4 py-2.5">
            <div className="text-[10px] font-bold text-[#35A8F7]">What</div>
            <input
              className="mt-0.5 w-full bg-transparent text-[12px] text-black/60 placeholder:text-black/30 focus:outline-none"
              placeholder="Any interest"
              data-testid="search-interest"
            />
          </div>
          <div className="px-4 py-2.5">
            <div className="text-[10px] font-bold text-[#35A8F7]">Where</div>
            <input
              className="mt-0.5 w-full bg-transparent text-[12px] text-black/60 placeholder:text-black/30 focus:outline-none"
              placeholder="San Francisco"
              data-testid="search-location"
            />
          </div>
          <div className="hidden px-4 py-2.5 lg:block">
            <div className="text-[10px] font-bold text-[#35A8F7]">Who</div>
            <input
              className="mt-0.5 w-full bg-transparent text-[12px] text-black/60 placeholder:text-black/30 focus:outline-none"
              placeholder="Add members"
              data-testid="search-members"
            />
          </div>
        </div>
        {/* Magnifying glass — Bubble Blue */}
        <button
          className="m-1.5 grid h-9 w-9 place-items-center rounded-full text-white shadow-[0_2px_8px_rgba(53,168,247,0.35)] transition-all hover:scale-105 hover:shadow-[0_4px_14px_rgba(53,168,247,0.45)]"
          style={{ background: "#35A8F7" }}
          data-testid="button-search"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {/* + Create dropdown */}
      <div ref={createRef} className="relative shrink-0">
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1.5 rounded-full border border-black/12 bg-white px-4 py-2.5 text-[12px] font-semibold text-black/70 shadow-sm transition hover:bg-black/4 hover:shadow-md"
          data-testid="button-create-menu"
        >
          + Create
          <ChevronDown className="h-3.5 w-3.5 opacity-50" strokeWidth={2} />
        </button>
        {showCreate && (
          <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.14)] z-50">
            <div className="p-1.5">
              <button
                onClick={() => { setShowCreate(false); navigate("/create"); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/4"
                data-testid="button-create-bubble"
              >
                <Users className="h-4 w-4 text-[#35A8F7] shrink-0" strokeWidth={1.8} />
                <span className="text-[13px] font-medium text-black">Create Bubble</span>
              </button>
              <button
                onClick={() => { setShowCreate(false); navigate("/create-event"); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/4"
                data-testid="button-create-event"
              >
                <CalendarDays className="h-4 w-4 text-[#35A8F7] shrink-0" strokeWidth={1.8} />
                <span className="text-[13px] font-medium text-black">Create Event</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Bubble card (Airbnb listing style) ─────────── */
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
      {/* Image */}
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

        {/* Heart */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSaved(!saved);
          }}
          className="absolute right-3 top-3 transition-transform hover:scale-110"
          data-testid={`button-save-${item.id}`}
        >
          <Heart
            className={cn(
              "h-6 w-6 drop-shadow-md transition-colors",
              saved ? "fill-[#35A8F7] text-[#35A8F7]" : "fill-white/30 text-white",
            )}
          />
        </button>

        {/* Privacy badge */}
        {item.privacy && item.privacy !== "Public" && (
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-black/75 shadow-sm backdrop-blur-sm">
            {item.privacy === "Request" ? "Request to join" : item.privacy}
          </div>
        )}
      </div>

      {/* Info below image */}
      <div className="mt-2.5 space-y-0.5 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <div
            className="truncate text-[14px] font-semibold text-black"
            data-testid={`text-bubble-title-${item.id}`}
          >
            {item.title}
          </div>
          <div className="shrink-0 text-[12px] font-semibold text-black/70">
            {item.members > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {item.members}
              </span>
            )}
          </div>
        </div>
        {item.category && (
          <div className="text-[12px] font-semibold text-[#35A8F7]">{item.category}</div>
        )}
        {item.tagline && (
          <div className="line-clamp-1 text-[12px] text-black/55">{item.tagline}</div>
        )}
        {item.miles && (
          <div className="flex items-center gap-1 pt-0.5 text-[12px] text-black/40">
            <MapPin className="h-3 w-3" />
            {item.miles}
          </div>
        )}
      </div>
    </motion.button>
  );
}

/* ─── Section header ─────────────────────────────── */
function SectionHeader({
  title,
  subtitle,
  onSeeAll,
}: {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <h2 className="text-[20px] font-bold text-black">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[13px] text-black/50">{subtitle}</p>
        )}
      </div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="text-[13px] font-semibold underline underline-offset-2 text-black/70 hover:text-black"
          data-testid="button-see-all"
        >
          Show all
        </button>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────── */
export default function Explore() {
  const [, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState("all");

  const { data: rawBubbles, isLoading } = useQuery<any[]>({
    queryKey: ["/api/bubbles"],
    queryFn: () => fetch("/api/bubbles").then((r) => r.json()),
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

  const filtered =
    activeCategory === "all"
      ? allBubbles
      : allBubbles.filter((b) =>
          (categoryMap[activeCategory] ?? []).some((cat) =>
            b.category.toLowerCase().includes(cat.toLowerCase()),
          ),
        );

  /* Split into sections */
  const popular = filtered.slice(0, 8);
  const newer   = filtered.slice(8, 16);

  return (
    <AppShell active="explore" centerContent={<SearchPill />}>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">

        {/* ── Search pill — mobile only (hidden in navbar on desktop) ── */}
        <div className="mb-5 md:hidden">
          <SearchPill />
        </div>

        {/* ── Category chips ── */}
        <div className="mb-8 border-b border-black/6 pb-1">
          <CategoryChips active={activeCategory} onChange={setActiveCategory} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2.5">
                <div className="aspect-square animate-pulse rounded-2xl bg-black/8" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-black/8" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-black/5" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Users className="mx-auto h-10 w-10 text-black/15" />
            <div className="mt-4 text-[15px] font-semibold text-black/50">No bubbles in this category yet</div>
            <div className="mt-1 text-[13px] text-black/35">Try a different filter or create one!</div>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Popular */}
            <section>
              <SectionHeader
                title="Popular near you"
                subtitle="The most active communities in your area"
              />
              <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {popular.map((b) => (
                  <BubbleCard
                    key={b.id}
                    item={b}
                    onOpen={(id) => navigate(`/bubble/${id}`)}
                  />
                ))}
              </div>
            </section>

            {/* More bubbles */}
            {newer.length > 0 && (
              <section>
                <SectionHeader
                  title="More to explore"
                  subtitle="Discover communities you haven't seen yet"
                />
                <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                  {newer.map((b) => (
                    <BubbleCard
                      key={b.id}
                      item={b}
                      onOpen={(id) => navigate(`/bubble/${id}`)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* FAB — mobile create */}
      <button
        onClick={() => navigate("/create")}
        className="fixed bottom-24 right-5 grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_4px_24px_rgba(53,168,247,0.45)] transition-transform hover:scale-105 md:hidden"
        style={{ background: "linear-gradient(135deg, #35A8F7, #6C63FF)" }}
        data-testid="button-fab-create"
      >
        <Plus className="h-6 w-6" />
      </button>
    </AppShell>
  );
}
