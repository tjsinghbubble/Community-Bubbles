import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Heart, Lock, MapPin, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

function BubbleCard({ item, onOpen }: { item: any; onOpen: () => void }) {
  const [saved, setSaved] = useState(false);
  const isRestricted = item.privacy === "Private" || item.privacy === "Request" || item.privacy === "Request to Join";
  const coverImg = item.images?.[0] || item.coverImage || "";

  return (
    <motion.button
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={onOpen}
      className="w-full text-left"
      data-testid={`card-my-bubble-${item.id}`}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-black/5">
        {coverImg ? (
          <img
            src={coverImg}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#35A8F7]/20 to-[#6C63FF]/20">
            <Users className="h-10 w-10 text-[#35A8F7]/40" />
          </div>
        )}

        {/* Heart */}
        <button
          onClick={(e) => { e.stopPropagation(); setSaved(!saved); }}
          className="absolute right-3 top-3 transition-transform hover:scale-110"
        >
          <Heart
            className={cn(
              "h-6 w-6 drop-shadow-md transition-colors",
              saved ? "fill-[#35A8F7] text-[#35A8F7]" : "fill-white/30 text-white",
            )}
          />
        </button>

        {/* Privacy badge */}
        {isRestricted && (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-black/75 shadow-sm backdrop-blur-sm">
            <Lock className="h-2.5 w-2.5" />
            {item.privacy === "Request" || item.privacy === "Request to Join" ? "Request to join" : "Private"}
          </div>
        )}

        {/* Role chip */}
        <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-black/75 shadow-sm backdrop-blur-sm">
          {item.role === "admin" ? "Admin" : "Member"}
        </div>
      </div>

      {/* Info below image */}
      <div className="mt-2.5 space-y-0.5 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate text-[14px] font-semibold text-black">{item.title}</div>
          {item.members > 0 && (
            <div className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-black/60">
              <Users className="h-3 w-3" />
              {item.members}
            </div>
          )}
        </div>
        {item.category && <div className="text-[12px] text-black/40">{item.category}</div>}
        {item.tagline && <div className="line-clamp-1 text-[12px] text-black/55">{item.tagline}</div>}
        {item.distance && (
          <div className="flex items-center gap-1 pt-0.5 text-[12px] text-black/40">
            <MapPin className="h-3 w-3" />
            {item.distance}
          </div>
        )}
      </div>
    </motion.button>
  );
}

export default function MyBubbles() {
  const [, navigate] = useLocation();

  const { data: bubbles, isLoading } = useQuery<any[]>({
    queryKey: ["/api/bubbles/my"],
    queryFn: () => apiRequest("GET", "/api/bubbles/my").then((r) => r.json()),
  });

  const list = bubbles ?? [];

  return (
    <AppShell active="bubbles">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-[28px] font-bold text-black">My Bubbles</h1>
            {!isLoading && (
              <p className="mt-1 text-[14px] text-black/45">
                {list.length} community{list.length !== 1 ? "s" : ""} you belong to
              </p>
            )}
          </div>
          <button
            onClick={() => navigate("/explore")}
            className="flex items-center gap-1.5 rounded-full border border-black/12 bg-white px-4 py-2 text-[13px] font-semibold shadow-sm transition hover:bg-black/5"
            data-testid="button-find-bubbles"
          >
            <Plus className="h-4 w-4" />
            Find more
          </button>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2.5">
                <div className="aspect-square animate-pulse rounded-2xl bg-black/8" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-black/8" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-black/5" />
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="py-24 text-center">
            <Users className="mx-auto h-12 w-12 text-black/15" />
            <div className="mt-4 text-[18px] font-bold text-black/50">No bubbles yet</div>
            <div className="mt-2 text-[14px] text-black/35">
              Find a community near you and join today.
            </div>
            <button
              onClick={() => navigate("/explore")}
              className="mx-auto mt-6 flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white shadow-md transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #35A8F7, #6C63FF)" }}
              data-testid="button-explore"
            >
              Explore bubbles
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((b) => (
              <BubbleCard
                key={b.id}
                item={b}
                onOpen={() => navigate(`/bubble/${b.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
