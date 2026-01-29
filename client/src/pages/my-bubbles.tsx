import { useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Lock, Globe, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LS_JOINED_PREFIX = "bubble:joined:";

type BubbleItem = {
  id: string;
  category: string;
  title: string;
  tagline: string;
  members: string;
  distance: string;
  privacy: "Public" | "Private";
  image: string;
};

const DEFAULT_BUBBLES: BubbleItem[] = [
  {
    id: "sf-pickleball",
    category: "Sports",
    title: "SF Pickleball Crew",
    tagline: "Morning hits, weekend ladders, and post-game brunch.",
    members: "1.2k",
    distance: "9.7 mi",
    privacy: "Public",
    image: new URL("../assets/images/explore-pickleball.jpg", import.meta.url).toString(),
  },
  {
    id: "mindful-mamas",
    category: "Wellness",
    title: "Mindful Mamas",
    tagline: "A calm corner for parents and daily resets.",
    members: "842",
    distance: "8.2 mi",
    privacy: "Private",
    image: new URL("../assets/images/explore-wellness.jpg", import.meta.url).toString(),
  },
  {
    id: "bark-dogpatch",
    category: "Animals",
    title: "Bark at Dogpatch",
    tagline: "Playdates, tips, and puppy photos (required).",
    members: "2.7k",
    distance: "9.1 mi",
    privacy: "Public",
    image: new URL("../assets/images/explore-dog.jpg", import.meta.url).toString(),
  },
  {
    id: "marina-meetup",
    category: "Neighborhood",
    title: "Marina Meetup",
    tagline: "Coffee walks, low-key hangs, and new friends.",
    members: "635",
    distance: "6.5 mi",
    privacy: "Public",
    image: new URL("../assets/images/explore-meetup.jpg", import.meta.url).toString(),
  },
  {
    id: "park-picnic",
    category: "Games",
    title: "Park Picnic & Cards",
    tagline: "Cards, snacks, sunshine. Bring your best deck.",
    members: "411",
    distance: "4.8 mi",
    privacy: "Public",
    image: new URL("../assets/images/explore-games.jpg", import.meta.url).toString(),
  },
  {
    id: "food-finds",
    category: "Food",
    title: "Food Finds",
    tagline: "New spots, hidden gems, and the best bites nearby.",
    members: "1.9k",
    distance: "3.2 mi",
    privacy: "Public",
    image: new URL("../assets/images/explore-food.jpg", import.meta.url).toString(),
  },
];

function pillGradientStyle() {
  return { background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" };
}

function Chip({ label }: { label: string }) {
  return (
    <div
      className="inline-flex items-center rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm ring-1 ring-black/5 backdrop-blur"
      data-testid={`badge-category-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
    </div>
  );
}

function MyBubbleCard({ item, onOpen }: { item: BubbleItem; onOpen: (id: string) => void }) {
  const PrivacyIcon = item.privacy === "Private" ? Lock : Globe;

  return (
    <button
      onClick={() => onOpen(item.id)}
      className="w-full text-left"
      data-testid={`card-my-bubble-${item.id}`}
    >
      <div className="overflow-hidden rounded-[26px] bg-white/55 ring-1 ring-black/5">
        <div className="relative aspect-[16/9]">
          <img
            src={item.image}
            alt=""
            className="h-full w-full object-cover"
            data-testid={`img-my-bubble-${item.id}`}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <Chip label={item.category} />
            <div
              className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm ring-1 ring-black/5 backdrop-blur"
              data-testid={`badge-privacy-${item.id}`}
            >
              <PrivacyIcon className="h-3.5 w-3.5" />
              {item.privacy}
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-display text-[16px] font-semibold tracking-tight" data-testid={`text-my-bubble-title-${item.id}`}>
                {item.title}
              </div>
              <div className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground" data-testid={`text-my-bubble-tagline-${item.id}`}>
                {item.tagline}
              </div>
            </div>
            <div
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1",
                "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] ring-[hsl(var(--primary))]/20",
              )}
              data-testid={`badge-member-${item.id}`}
            >
              Member
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[12px] text-muted-foreground">
            <div className="inline-flex items-center gap-1" data-testid={`row-members-${item.id}`}>
              <Users className="h-4 w-4" />
              <span>{item.members}</span>
            </div>
            <div className="text-[12px]" data-testid={`text-distance-${item.id}`}>
              {item.distance}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function BottomNav({ active, onSelect, unreadTotal }: { active: "explore" | "upcoming" | "bubbles" | "messages" | "profile"; onSelect: (id: "explore" | "upcoming" | "bubbles" | "messages" | "profile") => void; unreadTotal: number }) {
  const items = [
    { id: "explore", label: "Explore" },
    { id: "upcoming", label: "Upcoming" },
    { id: "bubbles", label: "Bubbles" },
    { id: "messages", label: "Messages" },
    { id: "profile", label: "Profile" },
  ] as const;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center">
      <div className="pointer-events-auto w-full max-w-[420px] px-4 pb-4">
        <div className="rounded-[26px] bg-white/70 px-3 py-2 shadow-[0_18px_60px_hsl(var(--foreground)/0.18)] ring-1 ring-black/5 backdrop-blur">
          <div className="grid grid-cols-5 gap-1">
            {items.map((it) => {
              const isActive = it.id === active;
              return (
                <button
                  key={it.id}
                  onClick={() => onSelect(it.id)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-medium",
                    isActive ? "text-[hsl(var(--primary))]" : "text-muted-foreground",
                  )}
                  data-testid={`tab-${it.id}`}
                >
                  <div
                    className={cn("h-5 w-5 rounded-md", isActive ? "bg-[hsl(var(--primary))]/15" : "bg-black/5")}
                    aria-hidden
                  />
                  {it.id === "messages" ? (
                    <div className="absolute right-3 top-1.5" data-testid="badge-messages-unread">
                      {unreadTotal > 0 ? (
                        <div className="grid min-w-[22px] place-items-center rounded-full bg-[hsl(var(--primary))] px-1.5 py-0.5 text-[11px] font-bold text-white" data-testid="badge-unread">
                          {unreadTotal > 99 ? "99+" : unreadTotal}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyBubbles() {
  const [, navigate] = useLocation();

  const joined = useMemo(() => {
    const ids: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i) || "";
      if (k.startsWith(LS_JOINED_PREFIX) && window.localStorage.getItem(k) === "1") {
        ids.push(k.replace(LS_JOINED_PREFIX, ""));
      }
    }
    return ids;
  }, []);

  const bubbles = useMemo(() => {
    const set = new Set(joined);
    return DEFAULT_BUBBLES.filter((b) => set.has(b.id));
  }, [joined]);

  const unreadTotal = useMemo(() => {
    try {
      const obj = JSON.parse(window.localStorage.getItem("bubble:unread:v1") || "{}");
      return Object.values(obj).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
    } catch {
      return 0;
    }
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px circle at 15% 10%, hsl(var(--primary) / .10), transparent 52%), radial-gradient(900px circle at 90% 25%, hsl(var(--brand-2) / .10), transparent 55%), radial-gradient(900px circle at 50% 90%, hsl(var(--brand-3) / .08), transparent 55%)",
          }}
        />
        <div className="absolute inset-0 bg-grid opacity-40" />
      </div>

      <div className="sticky top-0 z-20 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[420px] items-center justify-between px-5 py-4">
          <button
            onClick={() => navigate("/explore")}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5 backdrop-blur"
            data-testid="button-my-bubbles-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 text-center">
            <div className="truncate text-[15px] font-semibold tracking-tight" data-testid="text-my-bubbles-title">
              My Bubbles
            </div>
          </div>
          <div className="h-10 w-10" aria-hidden />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[420px] px-4 pb-28 pt-4">
        {bubbles.length === 0 ? (
          <div className="rounded-[26px] bg-white/55 p-6 text-center ring-1 ring-black/5">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="mt-4 text-[14px] font-semibold" data-testid="text-my-bubbles-empty-title">
              You haven’t joined any bubbles yet
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-muted-foreground" data-testid="text-my-bubbles-empty-subtitle">
              Explore nearby communities and join one to see it listed here.
            </div>
            <div className="mt-5">
              <Button
                onClick={() => navigate("/explore")}
                className="h-11 rounded-full px-6 text-[13px] font-semibold"
                style={pillGradientStyle()}
                data-testid="button-my-bubbles-explore"
              >
                Explore Bubbles
              </Button>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid grid-cols-1 gap-4"
            data-testid="grid-my-bubbles"
          >
            {bubbles.map((b) => (
              <MyBubbleCard key={b.id} item={b} onOpen={(id) => navigate(`/bubble/${id}`)} />
            ))}
          </motion.div>
        )}
      </div>

      <BottomNav
        active="bubbles"
        unreadTotal={unreadTotal}
        onSelect={(id) => {
          if (id === "explore") navigate("/explore");
          if (id === "messages") navigate("/messages");
          if (id === "bubbles") navigate("/my-bubbles");
        }}
      />
    </div>
  );
}
