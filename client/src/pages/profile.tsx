import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Settings, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

function InterestPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[hsl(var(--primary))]/10 px-3 py-1 text-[12px] font-semibold text-[hsl(var(--primary))]">
      {label}
    </span>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
  });

  const { data: myBubbles } = useQuery<any[]>({
    queryKey: ["/api/bubbles/my"],
    queryFn: () => apiRequest("GET", "/api/bubbles/my").then((r) => r.json()),
    enabled: !!user,
  });

  const displayName = me?.name || user?.name || "You";
  const email = me?.email || user?.email || "";
  const interests: string[] = me?.interests ?? [];
  const bubbleCount = myBubbles?.length ?? 0;

  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:pb-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-[24px] font-bold tracking-tight">Profile</h1>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-5 rounded-2xl bg-white/60 p-5 ring-1 ring-black/5">
            <div
              className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-[22px] font-bold text-white shadow"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
              data-testid="avatar-initials"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[18px] font-bold" data-testid="text-profile-name">
                {displayName}
              </div>
              <div className="mt-0.5 truncate text-[12px] text-muted-foreground" data-testid="text-profile-email">
                {email}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[hsl(var(--primary))]">
                <Users className="h-3.5 w-3.5" />
                <span data-testid="text-bubble-count">{bubbleCount} bubble{bubbleCount !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>

          {interests.length > 0 && (
            <div className="rounded-2xl bg-white/60 p-5 ring-1 ring-black/5">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Interests</div>
              <div className="flex flex-wrap gap-2" data-testid="list-interests">
                {interests.map((i) => (
                  <InterestPill key={i} label={i} />
                ))}
              </div>
            </div>
          )}

          {(myBubbles ?? []).length > 0 && (
            <div className="rounded-2xl bg-white/60 p-5 ring-1 ring-black/5">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                My Bubbles
              </div>
              <div className="space-y-2" data-testid="list-my-bubbles">
                {(myBubbles ?? []).slice(0, 8).map((b: any) => (
                  <button
                    key={b.id}
                    onClick={() => navigate(`/bubble/${b.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-black/5"
                    data-testid={`bubble-row-${b.id}`}
                  >
                    {(b.images?.[0] || b.coverImage) ? (
                      <img
                        src={b.images?.[0] || b.coverImage}
                        alt=""
                        className="h-9 w-9 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                        <Users className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">{b.title}</div>
                      <div className="text-[11px] text-muted-foreground">{b.category}</div>
                    </div>
                  </button>
                ))}
                {(myBubbles ?? []).length > 8 && (
                  <button
                    onClick={() => navigate("/my-bubbles")}
                    className="w-full pt-1 text-center text-[12px] font-semibold text-[hsl(var(--primary))]"
                  >
                    View all {myBubbles?.length} bubbles
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white/60 ring-1 ring-black/5">
            <button
              onClick={() => { logout(); navigate("/"); }}
              className="flex w-full items-center gap-3 px-5 py-4 text-[13px] font-semibold text-red-500 transition hover:bg-red-50/50"
              data-testid="button-sign-out"
            >
              <LogOut className="h-4.5 w-4.5" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
