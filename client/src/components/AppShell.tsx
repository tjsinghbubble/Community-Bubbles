import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Compass,
  MessageSquare,
  Plus,
  Users,
  User,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/queryClient";

const NAV_ITEMS = [
  { id: "explore",  label: "Explore",   icon: Compass,       href: "/explore" },
  { id: "upcoming", label: "Upcoming",  icon: CalendarDays,  href: "/upcoming" },
  { id: "bubbles",  label: "My Bubbles",icon: Users,         href: "/my-bubbles" },
  { id: "messages", label: "Messages",  icon: MessageSquare, href: "/messages" },
  { id: "profile",  label: "Profile",   icon: User,          href: "/profile" },
] as const;

type NavId = (typeof NAV_ITEMS)[number]["id"];

function BubbleLogo() {
  return (
    <span
      className="cursor-pointer select-none font-display text-[22px] font-bold tracking-tight"
      style={{
        background: "linear-gradient(135deg, #35A8F7, #6C63FF)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      bubble
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold text-white"
      style={{ background: "linear-gradient(135deg, #35A8F7, #6C63FF)" }}
    >
      {initials}
    </div>
  );
}

function CreateMenu({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();

  const options = [
    {
      label: "Create Bubble",
      description: "Start a new community",
      icon: Users,
      href: "/create",
      gradient: "linear-gradient(135deg, #35A8F7, #6C63FF)",
    },
    {
      label: "Create Event",
      description: "Plan something for your bubble",
      icon: CalendarDays,
      href: "/my-bubbles",
      gradient: "linear-gradient(135deg, #6C63FF, #A855F7)",
    },
  ];

  return (
    <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.14)] z-50">
      <div className="p-1.5">
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.label}
              onClick={() => {
                onClose();
                navigate(opt.href);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/4"
              data-testid={`menu-${opt.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
                style={{ background: opt.gradient }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-black">{opt.label}</div>
                <div className="text-[11px] text-black/45">{opt.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AppShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: NavId;
}) {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
  });

  const displayName = me?.name || user?.name || "Me";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    }
    if (showCreateMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCreateMenu]);

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-foreground">
      {/* ── Top navbar (all viewports, sticky) ── */}
      <header className="sticky top-0 z-40 border-b border-black/8 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">

          {/* Logo */}
          <div onClick={() => navigate("/explore")} className="shrink-0">
            <BubbleLogo />
          </div>

          {/* Desktop tab nav — center */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    "relative rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid={`nav-${item.id}`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute inset-x-4 -bottom-[1px] h-[2px] rounded-full bg-[#35A8F7]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Create button with dropdown */}
            <div ref={createMenuRef} className="relative hidden md:block">
              <button
                onClick={() => setShowCreateMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border border-black/12 bg-white px-4 py-2 text-[13px] font-semibold text-foreground shadow-sm transition hover:bg-black/5"
                data-testid="button-create"
              >
                <Plus className="h-4 w-4" />
                Create
              </button>
              {showCreateMenu && (
                <CreateMenu onClose={() => setShowCreateMenu(false)} />
              )}
            </div>

            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 rounded-full border border-black/12 bg-white p-1.5 pl-3 shadow-sm transition hover:shadow-md"
              data-testid="button-profile-menu"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <Avatar name={displayName} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="pb-24 md:pb-0">{children}</main>

      {/* ── Mobile bottom tabs ── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center md:hidden">
        <div className="pointer-events-auto w-full max-w-[520px] px-4 pb-4">
          <div className="rounded-[26px] bg-white px-2 py-2 shadow-[0_4px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/6">
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
                      isActive ? "text-[#35A8F7]" : "text-black/40 hover:text-black/70",
                    )}
                    data-testid={`tab-${item.id}`}
                  >
                    <Icon
                      className={cn(
                        "h-[22px] w-[22px] transition-all",
                        isActive && "scale-110",
                      )}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    {item.label === "My Bubbles" ? "Bubbles" : item.label}
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
