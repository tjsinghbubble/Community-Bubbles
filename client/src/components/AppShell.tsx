import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  HelpCircle,
  LogOut,
  Menu,
  Settings,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/queryClient";

/* ─── Custom icons matching mobile app exactly ───── */
function IconUpcoming({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 24" fill="none">
      <path d="M2.092 0C0.944 0 0.001 1.0097 0.001 2.2313L0 21.7735C0 22.995 0.945 24 2.091 24H15.907C17.055 24 17.998 22.995 17.998 21.7735V6.2812H17.999C18.001 6.2344 17.999 6.1875 17.994 6.1406C17.992 6.1303 17.991 6.12 17.989 6.1097C17.983 6.0703 17.974 6.0309 17.961 5.9925C17.961 5.9916 17.961 5.9906 17.961 5.9897C17.957 5.9803 17.954 5.97 17.95 5.9606C17.944 5.9437 17.938 5.9259 17.931 5.9091C17.931 5.9072 17.93 5.9053 17.929 5.9034C17.928 5.9016 17.927 5.8997 17.925 5.8978C17.923 5.8903 17.919 5.8828 17.915 5.8753C17.911 5.8678 17.906 5.8603 17.902 5.8528C17.902 5.8519 17.901 5.8509 17.901 5.85C17.894 5.8387 17.888 5.8275 17.882 5.8162C17.878 5.8097 17.873 5.8031 17.868 5.7966C17.859 5.7825 17.85 5.7694 17.84 5.7562C17.837 5.7534 17.834 5.7506 17.831 5.7478C17.819 5.7328 17.806 5.7169 17.793 5.7028L12.641 0.2212C12.601 0.18 12.558 0.1443 12.511 0.1143C12.503 0.1087 12.494 0.1031 12.485 0.0975C12.443 0.0731 12.399 0.0534 12.353 0.0384C12.333 0.0318 12.314 0.0262 12.295 0.0215C12.252 0.0112 12.207 0.0056 12.163 0.0047C12.155 0.0037 12.148 0.0028 12.14 0.0018L2.092 0ZM2.092 1.5H11.437V4.7549C11.437 5.9764 12.386 6.9814 13.535 6.9814H16.595V21.7733C16.595 22.1896 16.3 22.4999 15.907 22.4999H2.091C1.699 22.4999 1.404 22.1895 1.404 21.7733L1.405 2.2311C1.405 1.8149 1.701 1.5 2.092 1.5ZM12.847 2.5631L15.589 5.4796H13.534C13.142 5.4796 12.846 5.1702 12.846 4.7549L12.847 2.5631ZM7.244 7.6883L7.243 7.6892C7.056 7.6939 6.878 7.7774 6.75 7.9217L5.413 9.4058L4.84 8.7683H4.839C4.71 8.624 4.532 8.5405 4.344 8.5358C4.156 8.5321 3.975 8.6071 3.84 8.7458C3.704 8.8836 3.626 9.073 3.622 9.2727C3.617 9.4724 3.689 9.6655 3.819 9.8089L4.901 11.0043C5.034 11.1515 5.217 11.234 5.409 11.234C5.6 11.234 5.783 11.1515 5.915 11.0043L7.763 8.9617V8.9608C7.893 8.8177 7.966 8.6258 7.962 8.4261C7.959 8.2274 7.882 8.0374 7.747 7.8989C7.612 7.7605 7.431 7.6845 7.243 7.6883L7.244 7.6883ZM9.569 9.7139C9.381 9.7129 9.2 9.7929 9.068 9.9342C8.935 10.0746 8.861 10.2668 8.861 10.4665C8.863 10.8806 9.18 11.2158 9.569 11.2139H13.671H13.67C13.857 11.2148 14.037 11.1369 14.17 10.9965C14.302 10.8562 14.378 10.6659 14.378 10.4665C14.379 10.2668 14.305 10.0746 14.172 9.9342C14.039 9.7929 13.858 9.7129 13.67 9.7139L9.569 9.7139ZM7.244 12.4993V12.5012L7.243 12.5002C7.056 12.5049 6.878 12.5884 6.75 12.7327L5.413 14.2158L4.84 13.5793H4.839C4.71 13.435 4.532 13.3515 4.344 13.3468C4.156 13.3431 3.975 13.4181 3.84 13.5568C3.704 13.6946 3.626 13.884 3.622 14.0837C3.617 14.2834 3.689 14.4765 3.819 14.6199L4.901 15.8153C5.034 15.9625 5.217 16.045 5.409 16.045C5.6 16.045 5.783 15.9625 5.915 15.8153L7.763 13.7737C7.894 13.6306 7.967 13.4387 7.963 13.239C7.96 13.0393 7.883 12.8493 7.747 12.7099C7.612 12.5715 7.431 12.4955 7.243 12.4993L7.244 12.4993ZM9.569 13.5249C9.381 13.5239 9.2 13.6039 9.068 13.7452C8.935 13.8856 8.861 14.0778 8.861 14.2775C8.863 14.6916 9.18 15.0268 9.569 15.0249H13.671H13.67C13.857 15.0258 14.037 14.9479 14.17 14.8075C14.302 14.6672 14.378 14.4769 14.378 14.2775C14.379 14.0778 14.305 13.8856 14.172 13.7452C14.039 13.6039 13.858 13.5239 13.67 13.5249L9.569 13.5249ZM7.244 17.3103H7.243C7.056 17.3149 6.878 17.3984 6.75 17.5427L5.413 19.0268L4.84 18.3903H4.839C4.71 18.246 4.532 18.1625 4.344 18.1578C4.156 18.1541 3.975 18.2291 3.84 18.3678C3.704 18.5056 3.626 18.695 3.622 18.8947C3.618 19.0944 3.689 19.2875 3.819 19.4309L4.901 20.6273V20.6263C5.034 20.7735 5.217 20.856 5.409 20.856C5.6 20.856 5.783 20.7735 5.915 20.6263L7.763 18.5837V18.5827C7.894 18.4396 7.967 18.2477 7.963 18.0481C7.96 17.8484 7.883 17.6584 7.747 17.5199C7.612 17.3815 7.431 17.3055 7.243 17.3103L7.244 17.3103ZM9.569 18.3349C9.381 18.3339 9.201 18.4139 9.068 18.5552C8.935 18.6956 8.861 18.8878 8.861 19.0875C8.862 19.2872 8.937 19.4784 9.069 19.6188C9.202 19.7581 9.382 19.8371 9.569 19.836H13.671H13.67C13.858 19.8371 14.038 19.7581 14.17 19.6188C14.303 19.4784 14.378 19.2872 14.378 19.0875C14.379 18.8878 14.305 18.6956 14.172 18.5552C14.039 18.4139 13.858 18.3339 13.67 18.3349H9.569Z" fill={color} />
    </svg>
  );
}

function IconBubbles({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="-3 0 24 24" fill="none">
      <path d="M14.007 2C12.285 2.001 10.634 2.6859 9.416 3.9026C8.199 5.1204 7.514 6.7715 7.513 8.4935C7.871 17.1183 20.143 17.1183 20.5 8.4935C20.499 6.7715 19.814 5.1205 18.597 3.9026C17.38 2.6859 15.729 2.001 14.007 2ZM14.007 14.1653C12.503 14.1643 11.061 13.5667 9.997 12.503C8.933 11.4392 8.336 9.9976 8.335 8.4933C8.647 0.969 19.367 0.969 19.679 8.4933C19.677 9.9966 19.078 11.4381 18.015 12.5019C16.952 13.5646 15.51 14.1633 14.007 14.1653Z" fill={color} stroke={color} strokeWidth={0.4} />
      <path d="M14.007 4.6245C13.596 4.6245 12.865 4.5916 12.939 5.1749C12.959 5.2827 13.023 5.3771 13.113 5.4377C13.205 5.4993 13.316 5.5209 13.423 5.4993C14.5 5.296 15.602 5.6831 16.314 6.5159C17.025 7.3476 17.237 8.4976 16.869 9.5285C16.822 9.6548 16.84 9.7964 16.917 9.9073C16.994 10.0172 17.121 10.0829 17.255 10.0829C17.428 10.0829 17.583 9.9741 17.641 9.8119C18.074 8.6249 17.9 7.3014 17.177 6.2654C16.454 5.2294 15.271 4.6112 14.007 4.6082L14.007 4.6245Z" fill={color} stroke={color} strokeWidth={0.4} />
      <path d="M2.203 9.0601C0.956 9.0621 -0.239 9.558 -1.12 10.4401C-2.002 11.3211 -2.498 12.5162 -2.5 13.7628C-2.241 20.0015 6.647 20.0015 6.905 13.7628C6.903 12.5163 6.407 11.3211 5.525 10.4401C4.644 9.558 3.449 9.0621 2.203 9.0601H2.203ZM2.203 17.6439C1.174 17.6429 0.187 17.2332 -0.541 16.5063C-1.268 15.7783 -1.678 14.7915 -1.679 13.7626C-1.469 8.6163 5.874 8.6205 6.084 13.7626C6.083 14.7914 5.673 15.7782 4.946 16.5063C4.218 17.2332 3.231 17.6429 2.202 17.6439H2.203Z" fill={color} stroke={color} strokeWidth={0.4} />
      <path d="M1.369 11.1468C0.227 11.5061 -0.548 12.5658 -0.545 13.763C-0.545 14.1162 -0.545 14.7077 -0.073 14.7159C0.055 14.7189 0.177 14.6635 0.257 14.5639C0.337 14.4653 0.368 14.3349 0.338 14.2107C0.302 14.0638 0.284 13.9139 0.285 13.763C0.28 12.9292 0.815 12.1889 1.607 11.9312C1.811 11.8552 1.919 11.6345 1.857 11.427C1.794 11.2196 1.581 11.0964 1.369 11.1468Z" fill={color} stroke={color} strokeWidth={0.4} />
      <path d="M8.674 18.2406C8.259 18.4454 8.032 18.7961 8.112 19.1063C8.135 19.1979 8.174 19.3513 8.356 19.3073C8.405 19.2956 8.448 19.2693 8.473 19.2356C8.497 19.2022 8.5 19.1654 8.48 19.1361C8.457 19.1015 8.44 19.0644 8.43 19.0252C8.373 18.8094 8.53 18.5651 8.817 18.4207C8.89 18.3811 8.917 18.3132 8.879 18.2656C8.842 18.2179 8.752 18.2068 8.674 18.2406Z" fill={color} stroke={color} strokeWidth={0.4} />
      <path d="M9.986 16.0671C8.125 16.0692 6.618 17.5786 6.618 19.4391C6.786 23.8995 13.189 23.8995 13.358 19.4391C13.356 17.5775 11.847 16.0692 9.986 16.0671ZM9.986 21.9856C8.58 21.9836 7.441 20.8449 7.439 19.4392C7.558 16.0673 12.417 16.0673 12.536 19.4392C12.534 20.8459 11.392 21.9856 9.986 21.9856Z" fill={color} stroke={color} strokeWidth={0.4} />
    </svg>
  );
}

function IconMessages({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 19 18.54" fill="none">
      <path d="M2.9 13.5H17.192C17.269 13.5 17.34 13.4679 17.404 13.4038C17.468 13.3398 17.5 13.2692 17.5 13.1923V1.8077C17.5 1.7307 17.468 1.6602 17.404 1.5962C17.34 1.5321 17.269 1.5 17.192 1.5H1.808C1.731 1.5 1.66 1.5321 1.596 1.5962C1.532 1.6602 1.5 1.7307 1.5 1.8077V14.8848L2.9 13.5Z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function IconProfile({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12.003 0C5.384 0 0 5.3784 0 11.9971C0 15.1836 1.248 18.0842 3.281 20.2349C5.471 22.5514 8.571 24 12.003 24C18.622 24 24 18.6158 24 11.9971C24 5.3784 18.622 0 12.003 0ZM12.003 1.5C17.811 1.5 22.5 6.1894 22.5 11.9971C22.5 14.2949 21.765 16.4174 20.518 18.1452C19.616 15.6017 17.574 13.5946 14.995 12.7058C16.206 11.7936 16.99 10.3452 16.99 8.7197C16.99 5.9729 14.749 3.7255 12.003 3.7255C9.256 3.7255 7.013 5.9727 7.013 8.7197C7.013 10.3453 7.8 11.7938 9.01 12.7058C6.43 13.5936 4.384 15.6 3.481 18.1433C2.234 16.4164 1.5 14.2939 1.5 11.9971C1.5 6.1894 6.195 1.5 12.003 1.5ZM12.003 5.2265C13.939 5.2265 15.49 6.7846 15.49 8.7206C15.49 10.6566 13.939 12.2081 12.003 12.2081C10.067 12.2081 8.514 10.6565 8.514 8.7206C8.514 6.7847 10.067 5.2265 12.003 5.2265ZM12.003 13.7081C15.635 13.7081 18.622 16.1849 19.352 19.5019C17.46 21.3572 14.868 22.5 12.003 22.5C9.139 22.5 6.546 21.3581 4.652 19.5048C5.381 16.187 8.369 13.7081 12.003 13.7081Z" fill={color} />
    </svg>
  );
}

const MOBILE_TABS = [
  { id: "upcoming", label: "Upcoming", Icon: IconUpcoming, href: "/upcoming" },
  { id: "bubbles",  label: "Bubbles",  Icon: IconBubbles,  href: "/my-bubbles" },
  { id: "messages", label: "Messages", Icon: IconMessages, href: "/messages" },
  { id: "profile",  label: "Profile",  Icon: IconProfile,  href: "/profile" },
] as const;

export type NavId = "explore" | "upcoming" | "bubbles" | "messages" | "profile";

function BubbleLogo() {
  return (
    <span className="cursor-pointer select-none font-display text-[22px] font-bold tracking-tight text-[#35A8F7]">
      Bubble
    </span>
  );
}

function Avatar({ name, photo }: { name: string; photo?: string | null }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className="h-9 w-9 rounded-full object-cover shrink-0"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold text-white shrink-0"
      style={{ background: "#35A8F7" }}
    >
      {initials}
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
    { label: "Upcoming",  Icon: IconUpcoming,  href: "/upcoming" },
    { label: "Bubbles",   Icon: IconBubbles,   href: "/my-bubbles" },
    { label: "Messages",  Icon: IconMessages,  href: "/messages" },
    { label: "Profile",   Icon: IconProfile,   href: "/profile" },
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
        {navLinks.map(({ label, Icon, href }) => (
          <button
            key={label}
            onClick={() => go(href)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/4"
            data-testid={`nav-menu-${label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <span className="shrink-0 text-black/50" style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={18} color="currentColor" />
            </span>
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
  centerContent,
  subBar,
}: {
  children: React.ReactNode;
  active: NavId;
  centerContent?: React.ReactNode;
  subBar?: React.ReactNode;
}) {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [showNavMenu, setShowNavMenu] = useState(false);
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
      if (navMenuRef.current && !navMenuRef.current.contains(e.target as Node)) {
        setShowNavMenu(false);
      }
    }
    if (showNavMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNavMenu]);

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-foreground">
      {/* ── Top navbar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center gap-4 px-4 md:px-6">

          {/* Logo — left */}
          <div onClick={() => navigate("/explore")} className="shrink-0 cursor-pointer">
            <BubbleLogo />
          </div>

          {/* Center — optional slot (e.g. SearchPill on Explore), hidden on mobile */}
          {centerContent ? (
            <div className="hidden flex-1 justify-center px-4 md:flex">
              <div className="w-full max-w-2xl">
                {centerContent}
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* Right — avatar circle + hamburger circle */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Avatar → Profile */}
            <button
              onClick={() => navigate("/profile")}
              className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white shadow-sm transition hover:shadow-md"
              data-testid="button-avatar"
              title="Profile"
            >
              <Avatar name={displayName} photo={me?.profilePhoto} />
            </button>

            {/* Hamburger → nav dropdown */}
            <div ref={navMenuRef} className="relative">
              <button
                onClick={() => setShowNavMenu((v) => !v)}
                className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white shadow-sm transition hover:shadow-md"
                data-testid="button-nav-menu"
                title="Menu"
              >
                <Menu className="h-[18px] w-[18px] text-black/60" strokeWidth={1.8} />
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

        {/* ── Optional sub-bar (e.g. search row on Explore, like Airbnb) ── */}
        {subBar && (
          <div className="border-t border-black/6">
            {subBar}
          </div>
        )}
      </header>

      {/* ── Page content ── */}
      <main className="pb-24 md:pb-0">{children}</main>

      {/* ── Mobile bottom tabs (4 items) ── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center md:hidden">
        <div className="pointer-events-auto w-full max-w-[520px] px-4 pb-4">
          <div className="rounded-[26px] bg-white px-2 py-2 shadow-[0_4px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/6">
            <div className="grid grid-cols-4 gap-0.5">
              {MOBILE_TABS.map((item) => {
                const isActive = active === item.id;
                const iconColor = isActive ? "#35A8F7" : "rgba(0,0,0,0.4)";
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
                    <span className={cn("transition-transform", isActive && "scale-110")}>
                      <item.Icon size={22} color={iconColor} />
                    </span>
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
