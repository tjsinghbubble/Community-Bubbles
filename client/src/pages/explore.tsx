import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Bell, ListFilter, MapPin, Plus, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import pickleballImg from "@/assets/images/explore-pickleball.jpg";
import wellnessImg from "@/assets/images/explore-wellness.jpg";
import dogImg from "@/assets/images/explore-dog.jpg";
import meetupImg from "@/assets/images/explore-meetup.jpg";
import gamesImg from "@/assets/images/explore-games.jpg";
import foodImg from "@/assets/images/explore-food.jpg";

type BubbleCardItem = {
  id: string;
  category: string;
  title: string;
  time: string;
  miles: string;
  image: string;
};

const bubbles: BubbleCardItem[] = [
  {
    id: "sf-pickleball",
    category: "Sports",
    title: "SF Pickleball Crew",
    time: "6:00 PM",
    miles: "9.7 miles",
    image: pickleballImg,
  },
  {
    id: "mindful-mamas",
    category: "Wellness",
    title: "Mindful Mamas",
    time: "1:00 PM",
    miles: "8.2 miles",
    image: wellnessImg,
  },
  {
    id: "bark-dogpatch",
    category: "Animals",
    title: "Bark at Dogpatch",
    time: "3:30 PM",
    miles: "9.1 miles",
    image: dogImg,
  },
  {
    id: "marina-meetup",
    category: "Neighborhood",
    title: "Marina Meetup",
    time: "5:15 PM",
    miles: "6.5 miles",
    image: meetupImg,
  },
  {
    id: "park-picnic",
    category: "Games",
    title: "Park Picnic & Cards",
    time: "2:10 PM",
    miles: "4.8 miles",
    image: gamesImg,
  },
  {
    id: "food-finds",
    category: "Food",
    title: "Food Finds",
    time: "7:40 PM",
    miles: "3.2 miles",
    image: foodImg,
  },
];

function Chip({ label }: { label: string }) {
  return (
    <div
      className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm ring-1 ring-black/5 backdrop-blur"
      data-testid={`badge-category-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
    </div>
  );
}

function BubbleCard({ item, onOpen }: { item: BubbleCardItem; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(item.id)}
      className="w-full text-left"
      data-testid={`card-bubble-${item.id}`}
    >
      <div className="overflow-hidden rounded-[24px] bg-white/55 ring-1 ring-black/5">
        <div className="relative aspect-[4/3]">
          <img
            src={item.image}
            alt=""
            className="h-full w-full object-cover"
            data-testid={`img-bubble-${item.id}`}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
          <div className="absolute left-3 top-3">
            <Chip label={item.category} />
          </div>
        </div>
        <div className="px-3 pb-3 pt-3">
          <div
            className="font-display text-[15px] font-semibold tracking-tight"
            data-testid={`text-bubble-title-${item.id}`}
          >
            {item.title}
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-1" data-testid={`row-bubble-time-${item.id}`}>
              <Clock className="h-3.5 w-3.5" />
              <span>{item.time}</span>
            </div>
            <div className="inline-flex items-center gap-1" data-testid={`row-bubble-miles-${item.id}`}>
              <MapPin className="h-3.5 w-3.5" />
              <span>{item.miles}</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function BottomNav({
  active,
  onSelect,
  unreadTotal,
}: {
  active: "explore" | "upcoming" | "bubbles" | "messages" | "profile";
  onSelect: (id: "explore" | "upcoming" | "bubbles" | "messages" | "profile") => void;
  unreadTotal: number;
}) {
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
                    className={cn(
                      "h-5 w-5 rounded-md",
                      isActive ? "bg-[hsl(var(--primary))]/15" : "bg-black/5",
                    )}
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

export default function Explore() {
  const [, navigate] = useLocation();
  const [city] = useState("San Francisco");

  const list = useMemo(() => bubbles, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px circle at 20% 10%, hsl(var(--primary) / .10), transparent 52%), radial-gradient(900px circle at 90% 25%, hsl(var(--brand-2) / .10), transparent 55%), radial-gradient(900px circle at 50% 90%, hsl(var(--brand-3) / .08), transparent 55%)",
          }}
        />
        <div className="absolute inset-0 bg-grid opacity-40" />
      </div>

      <div className="mx-auto w-full max-w-[420px] px-4 pb-28 pt-4">
        <div className="flex items-center justify-between">
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5 backdrop-blur"
            data-testid="button-filters"
          >
            <ListFilter className="h-5 w-5" />
          </button>

          <div className="text-base font-semibold tracking-tight" data-testid="text-explore-title">
            Bubbles in {city}
          </div>

          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5 backdrop-blur"
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mt-5 grid grid-cols-2 gap-4"
          data-testid="grid-explore"
        >
          {list.map((b) => (
            <BubbleCard key={b.id} item={b} onOpen={(id) => navigate(`/bubble/${id}`)} />
          ))}
        </motion.div>

        <button
          onClick={() => navigate("/create")}
          className="fixed bottom-24 right-6 grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_18px_50px_hsl(var(--primary)/0.38)]"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
          data-testid="button-fab-create"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      <BottomNav
        active="explore"
        unreadTotal={(() => {
          try {
            const obj = JSON.parse(window.localStorage.getItem("bubble:unread:v1") || "{}");
            return Object.values(obj).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
          } catch {
            return 0;
          }
        })()}
        onSelect={(id) => {
          if (id === "explore") return navigate("/explore");
          if (id === "messages") return navigate("/messages");
          if (id === "bubbles") return navigate("/my-bubbles");
          return;
        }}
      />
    </div>
  );
}
