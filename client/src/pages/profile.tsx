import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  List,
  Lock,
  LogOut,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";
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

function SectionRow({
  icon: Icon,
  label,
  sublabel,
  onClick,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-black/5",
        danger ? "text-red-500" : "text-foreground",
      )}
      data-testid={`row-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          danger ? "text-red-400" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className={cn("text-[13px] font-semibold", danger && "text-red-500")}>
          {label}
        </div>
        {sublabel && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</div>
        )}
      </div>
      {!danger && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </button>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white/60 ring-1 ring-black/5">
      <div className="border-b border-black/5 px-5 py-3">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="divide-y divide-black/5">{children}</div>
    </div>
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
  const isSuperAdmin = me?.isSuperAdmin === true;
  const isBubbleAdmin = (myBubbles ?? []).some((b: any) => b.role === "admin");
  const hasAdminSection = isSuperAdmin || isBubbleAdmin;

  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:pb-8">
        <div className="mb-6">
          <h1 className="font-display text-[24px] font-bold tracking-tight">Profile</h1>
        </div>

        <div className="space-y-4">
          {/* ── Identity card ── */}
          <div className="flex items-center gap-5 rounded-2xl bg-white/60 p-5 ring-1 ring-black/5">
            <div
              className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-[22px] font-bold text-white shadow"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))",
              }}
              data-testid="avatar-initials"
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-[18px] font-bold"
                data-testid="text-profile-name"
              >
                {displayName}
              </div>
              <div
                className="mt-0.5 truncate text-[12px] text-muted-foreground"
                data-testid="text-profile-email"
              >
                {email}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[hsl(var(--primary))]">
                <Users className="h-3.5 w-3.5" />
                <span data-testid="text-bubble-count">
                  {bubbleCount} bubble{bubbleCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate("/profile/edit")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/5 text-muted-foreground transition hover:bg-black/10"
              data-testid="button-edit-profile"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {/* ── Interests ── */}
          {interests.length > 0 && (
            <div className="rounded-2xl bg-white/60 p-5 ring-1 ring-black/5">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                Interests
              </div>
              <div className="flex flex-wrap gap-2" data-testid="list-interests">
                {interests.map((i) => (
                  <InterestPill key={i} label={i} />
                ))}
              </div>
            </div>
          )}

          {/* ── My Bubbles preview ── */}
          {bubbleCount > 0 && (
            <div className="rounded-2xl bg-white/60 p-5 ring-1 ring-black/5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                  My Bubbles
                </span>
                <button
                  onClick={() => navigate("/my-bubbles")}
                  className="text-[12px] font-semibold text-[hsl(var(--primary))]"
                >
                  View all
                </button>
              </div>
              <div className="space-y-2" data-testid="list-my-bubbles">
                {(myBubbles ?? []).slice(0, 4).map((b: any) => (
                  <button
                    key={b.id}
                    onClick={() => navigate(`/bubble/${b.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-black/5"
                    data-testid={`bubble-row-${b.id}`}
                  >
                    {b.images?.[0] || b.coverImage ? (
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
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Administration ── */}
          {hasAdminSection && (
            <div className="overflow-hidden rounded-2xl bg-white/60 ring-1 ring-black/5">
              <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Administration
                </span>
                <span
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                  style={{ background: "#35A8F7" }}
                  data-testid="badge-admin-role"
                >
                  <Shield className="h-3 w-3" />
                  {isSuperAdmin ? "Super Admin" : "Admin"}
                </span>
              </div>
              <div className="divide-y divide-black/5">
                <SectionRow
                  icon={Clock}
                  label="Needs Attention"
                  sublabel="Review pending bubbles, events & requests"
                  onClick={() => navigate("/admin/pending")}
                />
                {isSuperAdmin && (
                  <SectionRow
                    icon={List}
                    label="Manage Rules"
                    sublabel="App-wide and category-level rules"
                    onClick={() => navigate("/admin/rules")}
                  />
                )}
                {isSuperAdmin && (
                  <SectionRow
                    icon={FolderOpen}
                    label="Manage Categories"
                    sublabel="Add, edit, and organize interest categories"
                    onClick={() => navigate("/admin/categories")}
                  />
                )}
                {isSuperAdmin && (
                  <SectionRow
                    icon={Activity}
                    label="System Monitor"
                    sublabel="Database health, uptime, and platform stats"
                    onClick={() => navigate("/admin/monitor")}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Account ── */}
          <SectionCard title="Account">
            <SectionRow
              icon={User}
              label="Edit Profile"
              sublabel="Name, photo, bio, interests"
              onClick={() => navigate("/profile/edit")}
            />
            <SectionRow
              icon={Bell}
              label="Notifications"
              sublabel="Push, email, and in-app alerts"
              onClick={() => navigate("/profile/notifications")}
            />
            <SectionRow
              icon={Lock}
              label="Privacy"
              sublabel="Who can see your profile"
              onClick={() => navigate("/profile/privacy")}
            />
          </SectionCard>

          {/* ── Legal ── */}
          <SectionCard title="Legal">
            <SectionRow
              icon={FileText}
              label="Terms of Service"
              onClick={() => navigate("/legal/terms")}
            />
            <SectionRow
              icon={Shield}
              label="Privacy Policy"
              onClick={() => navigate("/legal/privacy")}
            />
            <SectionRow
              icon={FileText}
              label="Community Guidelines"
              onClick={() => navigate("/legal/community")}
            />
          </SectionCard>

          {/* ── Sign out ── */}
          <div className="overflow-hidden rounded-2xl bg-white/60 ring-1 ring-black/5">
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="flex w-full items-center gap-3 px-5 py-4 text-left text-red-500 transition hover:bg-red-50/50"
              data-testid="button-sign-out"
            >
              <LogOut className="h-5 w-5 shrink-0 text-red-400" />
              <span className="text-[13px] font-semibold">Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
