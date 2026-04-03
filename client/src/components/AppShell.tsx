import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  HelpCircle,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  Shield,
  Users,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/queryClient";

const MOBILE_TABS = [
  { id: "upcoming", label: "Upcoming", icon: CalendarDays, href: "/upcoming" },
  { id: "bubbles",  label: "Bubbles",  icon: Users,        href: "/my-bubbles" },
  { id: "messages", label: "Messages", icon: MessageSquare, href: "/messages" },
  { id: "profile",  label: "Profile",  icon: User,         href: "/profile" },
] as const;

export type NavId = "explore" | "upcoming" | "bubbles" | "messages" | "profile";

function BubbleLogo() {
  return (
    <span className="cursor-pointer select-none font-display text-[22px] font-bold tracking-tight text-[#35A8F7]">
      Bubble
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
      className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold text-white shrink-0"
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
    },
    {
      label: "Create Event",
      description: "Plan something for your bubble",
      icon: CalendarDays,
      href: "/create-event",
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
              onClick={() => { onClose(); navigate(opt.href); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/4"
              data-testid={`menu-${opt.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
                style={{ background: "#35A8F7" }}
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

function NavMenu({
  onClose,
  displayName,
  isSuperAdmin,
  isBubbleAdmin,
  onLogout,
}: {
  onClose: () => void;
  displayName: string;
  isSuperAdmin: boolean;
  isBubbleAdmin: boolean;
  onLogout: () => void;
}) {
  const [, navigate] = useLocation();

  const go = (href: string) => { onClose(); navigate(href); };

  const navLinks = [
    { label: "Upcoming",  icon: CalendarDays,  href: "/upcoming" },
    { label: "Bubbles",   icon: Users,         href: "/my-bubbles" },
    { label: "Messages",  icon: MessageSquare, href: "/messages" },
    { label: "Profile",   icon: User,          href: "/profile" },
  ];

  const settingsLinks = [
    { label: "Account Settings", icon: Settings,   href: "/profile" },
    { label: "Get Help",         icon: HelpCircle, href: "/legal/terms" },
  ];

  return (
    <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.16)] z-50">
      {/* User greeting */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/6">
        <Avatar name={displayName} />
        <span className="text-[13px] font-semibold text-black truncate">{displayName}</span>
      </div>

      {/* Primary nav links */}
      <div className="p-1.5">
        {navLinks.map(({ label, icon: Icon, href }) => (
          <button
            key={label}
            onClick={() => go(href)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/4"
            data-testid={`nav-menu-${label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Icon className="h-[18px] w-[18px] text-black/60 shrink-0" strokeWidth={1.8} />
            <span className="text-[13px] font-medium text-black">{label}</span>
          </button>
        ))}
      </div>

      <div className="mx-3 h-px bg-black/6" />

      {/* Admin + settings links */}
      <div className="p-1.5">
        {(isSuperAdmin || isBubbleAdmin) && (
          <button
            onClick={() => go("/admin/pending")}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/4"
            data-testid="nav-menu-administration"
          >
            <Shield className="h-[18px] w-[18px] text-[#35A8F7] shrink-0" strokeWidth={1.8} />
            <span className="text-[13px] font-medium text-black">Administration</span>
          </button>
        )}
        {settingsLinks.map(({ label, icon: Icon, href }) => (
          <button
            key={label}
            onClick={() => go(href)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/4"
            data-testid={`nav-menu-${label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Icon className="h-[18px] w-[18px] text-black/60 shrink-0" strokeWidth={1.8} />
            <span className="text-[13px] font-medium text-black">{label}</span>
          </button>
        ))}
      </div>

      <div className="mx-3 h-px bg-black/6" />

      {/* Log out */}
      <div className="p-1.5">
        <button
          onClick={() => { onClose(); onLogout(); }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/4"
          data-testid="nav-menu-logout"
        >
          <LogOut className="h-[18px] w-[18px] text-[#E8453C] shrink-0" strokeWidth={1.8} />
          <span className="text-[13px] font-medium text-[#E8453C]">Log Out</span>
        </button>
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
  const [showNavMenu, setShowNavMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const navMenuRef = useRef<HTMLDivElement>(null);

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

  const displayName = me?.name || user?.name || "Me";
  const isSuperAdmin = me?.isSuperAdmin === true;
  const isBubbleAdmin = (myBubbles ?? []).some((b: any) => b.role === "admin");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
      if (navMenuRef.current && !navMenuRef.current.contains(e.target as Node)) {
        setShowNavMenu(false);
      }
    }
    if (showCreateMenu || showNavMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCreateMenu, showNavMenu]);

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-foreground">
      {/* ── Top navbar ── */}
      <header className="sticky top-0 z-40 border-b border-black/8 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">

          {/* Logo */}
          <div onClick={() => navigate("/explore")} className="shrink-0">
            <BubbleLogo />
          </div>

          {/* Center — intentionally empty (Explore is the home page) */}
          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Create button */}
            <div ref={createMenuRef} className="relative hidden md:block">
              <button
                onClick={() => { setShowNavMenu(false); setShowCreateMenu((v) => !v); }}
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

            {/* Hamburger + avatar pill */}
            <div ref={navMenuRef} className="relative">
              <button
                onClick={() => { setShowCreateMenu(false); setShowNavMenu((v) => !v); }}
                className="flex items-center gap-2.5 rounded-full border border-black/12 bg-white px-3 py-1.5 shadow-sm transition hover:shadow-md"
                data-testid="button-nav-menu"
              >
                <Menu className="h-[18px] w-[18px] text-black/60" strokeWidth={1.8} />
                <Avatar name={displayName} />
              </button>
              {showNavMenu && (
                <NavMenu
                  onClose={() => setShowNavMenu(false)}
                  displayName={displayName}
                  isSuperAdmin={isSuperAdmin}
                  isBubbleAdmin={isBubbleAdmin}
                  onLogout={handleLogout}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="pb-24 md:pb-0">{children}</main>

      {/* ── Mobile bottom tabs (4 items, Explore is home) ── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center md:hidden">
        <div className="pointer-events-auto w-full max-w-[520px] px-4 pb-4">
          <div className="rounded-[26px] bg-white px-2 py-2 shadow-[0_4px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/6">
            <div className="grid grid-cols-4 gap-0.5">
              {MOBILE_TABS.map((item) => {
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
                      className={cn("h-[22px] w-[22px] transition-all", isActive && "scale-110")}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    {item.label}
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
