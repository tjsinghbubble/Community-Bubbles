import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Globe, Lock, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

function Chip({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm ring-1 ring-black/5 backdrop-blur">
      {label}
    </div>
  );
}

function MyBubbleCard({ item, onOpen }: { item: any; onOpen: (id: string) => void }) {
  const isPrivate = item.privacy === "Private" || item.privacy === "Request to Join";
  const PrivacyIcon = isPrivate ? Lock : Globe;
  const coverImg = item.images?.[0] || item.coverImage || "";

  return (
    <button onClick={() => onOpen(item.id)} className="w-full text-left" data-testid={`card-my-bubble-${item.id}`}>
      <div className="overflow-hidden rounded-[26px] bg-white/60 ring-1 ring-black/5 transition hover:bg-white/80">
        <div className="relative aspect-[16/9] bg-black/5">
          {coverImg ? (
            <img src={coverImg} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Users className="h-10 w-10 text-black/20" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            {item.category && <Chip label={item.category} />}
            <div className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-semibold shadow-sm ring-1 ring-black/5 backdrop-blur">
              <PrivacyIcon className="h-3.5 w-3.5" />
              {item.privacy || "Public"}
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-display text-[16px] font-semibold tracking-tight">
                {item.title}
              </div>
              {item.tagline && (
                <div className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                  {item.tagline}
                </div>
              )}
            </div>
            <div className="shrink-0 rounded-full bg-[hsl(var(--primary))]/10 px-3 py-1 text-[11px] font-semibold text-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]/20">
              {item.role === "admin" ? "Admin" : "Member"}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{item.members ?? 0} members</span>
            {item.distance && <span className="ml-auto">{item.distance}</span>}
          </div>
        </div>
      </div>
    </button>
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
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:pb-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-[24px] font-bold tracking-tight">My Bubbles</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {isLoading ? "Loading…" : `${list.length} bubble${list.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => navigate("/explore")}
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-white shadow"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
            data-testid="button-find-bubbles"
          >
            Find bubbles
          </button>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Loading your bubbles…</div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-black/8 bg-white/60 p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <div className="mt-3 text-[14px] font-semibold">No bubbles yet</div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              Explore and join communities near you.
            </div>
            <button
              onClick={() => navigate("/explore")}
              className="mt-4 rounded-full px-5 py-2 text-[13px] font-semibold text-white shadow"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
              data-testid="button-explore"
            >
              Explore
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {list.map((b) => (
              <MyBubbleCard key={b.id} item={b} onOpen={(id) => navigate(`/bubble/${b.id}`)} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
