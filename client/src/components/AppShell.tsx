import { useLocation } from "wouter";
import { CalendarDays, Compass, LogOut, MessageSquare, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS = [
  { id: "explore", label: "Explore", icon: Compass, href: "/explore" },
  { id: "upcoming", label: "Upcoming", icon: CalendarDays, href: "/upcoming" },
  { id: "bubbles", label: "Bubbles", shortLabel: "Bubbles", icon: Users, href: "/my-bubbles" },
  { id: "messages", label: "Messages", icon: MessageSquare, href: "/messages" },
  { id: "profile", label: "Profile", icon: User, href: "/profile" },
] as const;

type NavId = (typeof NAV_ITEMS)[number]["id"];

export function AppShell({ children, active }: { children: React.ReactNode; active: NavId }) {
  const [, navigate] = useLocation();
  const { logout } = useAuth();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col md:border-r md:border-black/8 md:bg-white/90 md:backdrop-blur-xl">
        <div className="flex h-14 shrink-0 items-center px-5">
          <span
            className="font-display text-[20px] font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Bubble
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.href)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors",
                  isActive
                    ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                    : "text-foreground/55 hover:bg-black/5 hover:text-foreground",
                )}
                data-testid={`nav-${item.id}`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-black/8 px-3 py-3">
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-red-500 transition-colors hover:bg-red-50"
            data-testid="nav-logout"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="md:ml-56">{children}</main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center md:hidden">
        <div className="pointer-events-auto w-full max-w-[480px] px-4 pb-4">
          <div className="rounded-[26px] bg-white/75 px-2 py-2 shadow-[0_18px_60px_hsl(var(--foreground)/0.18)] ring-1 ring-black/5 backdrop-blur-xl">
            <div className="grid grid-cols-5 gap-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.href)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold transition-colors",
                      isActive ? "text-[hsl(var(--primary))]" : "text-muted-foreground",
                    )}
                    data-testid={`tab-${item.id}`}
                  >
                    <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                    {"shortLabel" in item ? item.shortLabel : item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
