import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Bell, ListFilter, MapPin, Plus, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { AppShell } from "@/components/AppShell";

type BubbleCardItem = {
  id: string;
  category: string;
  title: string;
  members: number;
  miles: string;
  image: string;
};

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
      <div className="overflow-hidden rounded-[24px] bg-white/60 ring-1 ring-black/5 transition hover:bg-white/80">
        <div className="relative aspect-[4/3] bg-black/5">
          {item.image ? (
            <img
              src={item.image}
              alt=""
              className="h-full w-full object-cover"
              data-testid={`img-bubble-${item.id}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Users className="h-8 w-8 text-black/20" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
          <div className="absolute left-3 top-3">
            {item.category && <Chip label={item.category} />}
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
            <div className="inline-flex items-center gap-1" data-testid={`row-bubble-members-${item.id}`}>
              <Users className="h-3.5 w-3.5" />
              <span>{item.members} members</span>
            </div>
            {item.miles ? (
              <div className="inline-flex items-center gap-1" data-testid={`row-bubble-miles-${item.id}`}>
                <MapPin className="h-3.5 w-3.5" />
                <span>{item.miles}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Explore() {
  const [, navigate] = useLocation();
  const [city] = useState("San Francisco");

  const { data: rawBubbles, isLoading } = useQuery<any[]>({
    queryKey: ["/api/bubbles"],
    queryFn: () => fetch("/api/bubbles").then((r) => r.json()),
  });

  const list: BubbleCardItem[] = (rawBubbles ?? []).map((b: any) => ({
    id: b.id,
    category: b.category ?? "",
    title: b.title ?? "",
    members: b.members ?? 0,
    miles: b.distance ?? "",
    image: (b.images && b.images[0]) || b.coverImage || "",
  }));

  return (
    <AppShell active="explore">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px circle at 20% 10%, hsl(var(--primary) / .10), transparent 52%), radial-gradient(900px circle at 90% 25%, hsl(var(--brand-2) / .10), transparent 55%), radial-gradient(900px circle at 50% 90%, hsl(var(--brand-3) / .08), transparent 55%)",
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 md:pb-8">
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
          className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3"
          data-testid="grid-explore"
        >
          {isLoading ? (
            <div className="col-span-full py-10 text-center text-[13px] text-muted-foreground" data-testid="loading-bubbles">
              Loading bubbles…
            </div>
          ) : list.length === 0 ? (
            <div className="col-span-full py-10 text-center text-[13px] text-muted-foreground" data-testid="empty-bubbles">
              No bubbles nearby yet.
            </div>
          ) : (
            list.map((b) => (
              <BubbleCard key={b.id} item={b} onOpen={(id) => navigate(`/bubble/${id}`)} />
            ))
          )}
        </motion.div>

        <button
          onClick={() => navigate("/create")}
          className="fixed bottom-24 right-6 grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_18px_50px_hsl(var(--primary)/0.38)] md:bottom-8"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
          data-testid="button-fab-create"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </AppShell>
  );
}
