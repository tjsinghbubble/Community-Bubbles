import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Compass,
  Heart,
  ImagePlus,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

type Bubble = {
  id: string;
  name: string;
  description: string;
  members: number;
  isPrivate: boolean;
  tags: string[];
  accent: "violet" | "cyan" | "amber" | "green" | "pink";
};

type EventItem = {
  id: string;
  title: string;
  bubble: string;
  when: string;
  location: string;
  attendees: number;
  accent: Bubble["accent"];
};

const bubblesSeed: Bubble[] = [
  {
    id: "b-1",
    name: "Weekend Hikers",
    description: "Easy trails, good coffee, zero pressure.",
    members: 1248,
    isPrivate: false,
    tags: ["outdoor", "fitness", "nearby"],
    accent: "green",
  },
  {
    id: "b-2",
    name: "Film Photo Club",
    description: "Shoot, scan, share. Darkroom nights monthly.",
    members: 812,
    isPrivate: true,
    tags: ["arts", "photo", "invite"],
    accent: "pink",
  },
  {
    id: "b-3",
    name: "Indie Game Builders",
    description: "Co-working sprints + playtests every Thursday.",
    members: 1520,
    isPrivate: false,
    tags: ["gaming", "tech", "creators"],
    accent: "violet",
  },
  {
    id: "b-4",
    name: "Supper & Stories",
    description: "A rotating dinner table for curious humans.",
    members: 640,
    isPrivate: false,
    tags: ["food", "community", "events"],
    accent: "amber",
  },
  {
    id: "b-5",
    name: "Studio Sessions",
    description: "Live sets, feedback, and tiny venue energy.",
    members: 990,
    isPrivate: false,
    tags: ["music", "arts", "nearby"],
    accent: "cyan",
  },
];

const eventsSeed: EventItem[] = [
  {
    id: "e-1",
    title: "Sunset ridge hike",
    bubble: "Weekend Hikers",
    when: "Fri • 6:30 PM",
    location: "Trailhead A (Parking: Lot 3)",
    attendees: 34,
    accent: "green",
  },
  {
    id: "e-2",
    title: "35mm photowalk",
    bubble: "Film Photo Club",
    when: "Sat • 10:00 AM",
    location: "Market District",
    attendees: 18,
    accent: "pink",
  },
  {
    id: "e-3",
    title: "Playtest night",
    bubble: "Indie Game Builders",
    when: "Thu • 7:00 PM",
    location: "Co-op Space",
    attendees: 56,
    accent: "violet",
  },
];

function accentClasses(accent: Bubble["accent"]) {
  switch (accent) {
    case "violet":
      return {
        chip: "bg-primary/10 text-primary border-primary/20",
        dot: "bg-primary",
        glow: "from-primary/20 via-primary/10 to-transparent",
      };
    case "cyan":
      return {
        chip: "bg-[hsl(var(--brand-2))]/10 text-[hsl(var(--brand-2))] border-[hsl(var(--brand-2))]/25",
        dot: "bg-[hsl(var(--brand-2))]",
        glow: "from-[hsl(var(--brand-2))]/20 via-[hsl(var(--brand-2))]/10 to-transparent",
      };
    case "amber":
      return {
        chip: "bg-[hsl(var(--brand-3))]/10 text-[hsl(var(--brand-3))] border-[hsl(var(--brand-3))]/25",
        dot: "bg-[hsl(var(--brand-3))]",
        glow: "from-[hsl(var(--brand-3))]/18 via-[hsl(var(--brand-3))]/8 to-transparent",
      };
    case "green":
      return {
        chip: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-300",
        dot: "bg-emerald-500",
        glow: "from-emerald-500/18 via-emerald-500/8 to-transparent",
      };
    case "pink":
      return {
        chip: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/25 dark:text-fuchsia-300",
        dot: "bg-fuchsia-500",
        glow: "from-fuchsia-500/16 via-fuchsia-500/8 to-transparent",
      };
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-70" />
        <div className="absolute inset-0 noise opacity-60" />
        <div
          className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, hsl(var(--primary) / .20), transparent 58%), radial-gradient(circle at 70% 70%, hsl(var(--brand-2) / .18), transparent 60%), radial-gradient(circle at 60% 20%, hsl(var(--brand-3) / .16), transparent 62%)",
            filter: "blur(2px)",
          }}
        />
      </div>

      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-2xl border bg-white/60 shadow-sm dark:bg-white/5"
              data-testid="badge-logo"
            >
              <Sparkles className="h-4 w-4 text-primary" strokeWidth={2.2} />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base font-semibold tracking-tight">
                Bubble
              </div>
              <div className="text-xs text-muted-foreground" data-testid="text-tagline">
                Communities, photos, events, chat
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                data-testid="input-search"
                placeholder="Search bubbles, events, people"
                className="w-[360px] rounded-2xl pl-9"
              />
            </div>
            <Button asChild data-testid="button-create" className="rounded-2xl" size="sm">
              <Link href="/create">
                <Plus className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-2xl"
              data-testid="button-notifications"
            >
              <Bell className="h-4 w-4" />
            </Button>
            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden text-sm font-medium sm:inline-block" data-testid="text-username">
                  {user.name.split(" ")[0]}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-2xl text-muted-foreground hover:text-foreground"
                  onClick={handleLogout}
                  data-testid="button-logout"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button asChild variant="secondary" size="sm" className="rounded-2xl" data-testid="button-signin">
                <Link href="/auth">
                  <Users className="mr-2 h-4 w-4" />
                  Sign In
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-2 text-xs text-muted-foreground sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div data-testid="text-footer">
            Bubble — local communities built around shared interests.
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
            data-testid="link-home"
          >
            Back to top <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative">
      <div className="glass ring-soft hover-lift overflow-hidden rounded-[28px] px-5 py-6 sm:px-8 sm:py-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(900px circle at 20% 10%, hsl(var(--primary) / .18), transparent 55%), radial-gradient(900px circle at 90% 30%, hsl(var(--brand-2) / .15), transparent 58%), radial-gradient(900px circle at 50% 90%, hsl(var(--brand-3) / .12), transparent 55%)",
          }}
        />
        <div className="relative">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <Badge
                className="rounded-full border bg-white/60 px-3 py-1 text-xs font-medium text-foreground/80 dark:bg-white/5"
                data-testid="badge-hero"
              >
                🪶 Communities that feel close
              </Badge>
              <h1
                className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-5xl"
                data-testid="text-title"
              >
                Find your people, then{" "}
                <span className="text-primary">do things together</span>.
              </h1>
              <p
                className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base"
                data-testid="text-subtitle"
              >
                Bubbles are interest-based communities with photo sharing, chat,
                and events—designed to be lively, safe, and simple.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild className="h-11 rounded-2xl" data-testid="button-join">
                  <Link href="/explore">
                    <Compass className="mr-2 h-4 w-4" />
                    Explore bubbles
                  </Link>
                </Button>
                <Button
                  variant="secondary"
                  className="h-11 rounded-2xl"
                  data-testid="button-share"
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Share a moment
                </Button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span data-testid="text-safety">Privacy controls built-in</span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 md:mt-0 md:w-[320px]">
              <Stat
                label="Active today"
                value="4.2k"
                icon={<Sparkles className="h-4 w-4" />}
                testId="stat-active"
              />
              <Stat
                label="Upcoming events"
                value="38"
                icon={<CalendarDays className="h-4 w-4" />}
                testId="stat-events"
              />
              <Stat
                label="New photos"
                value="120"
                icon={<ImagePlus className="h-4 w-4" />}
                testId="stat-photos"
              />
              <Stat
                label="Messages"
                value="1.1k"
                icon={<MessageCircle className="h-4 w-4" />}
                testId="stat-messages"
              />
            </div>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <FeaturePill
              title="Bubbles"
              desc="Create & join interest groups"
              icon={<Users className="h-4 w-4" />}
              testId="feature-bubbles"
            />
            <FeaturePill
              title="Photo sharing"
              desc="Moments with captions"
              icon={<Heart className="h-4 w-4" />}
              testId="feature-photos"
            />
            <FeaturePill
              title="Messaging"
              desc="Direct & group chats"
              icon={<MessageCircle className="h-4 w-4" />}
              testId="feature-messaging"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  icon,
  testId,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  testId: string;
}) {
  return (
    <div
      className="glass rounded-2xl px-4 py-3"
      data-testid={`card-${testId}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground" data-testid={`text-${testId}-label`}>
          {label}
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div
        className="mt-1 font-display text-xl font-semibold tracking-tight"
        data-testid={`text-${testId}-value`}
      >
        {value}
      </div>
    </div>
  );
}

function FeaturePill({
  title,
  desc,
  icon,
  testId,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  testId: string;
}) {
  return (
    <div
      className="group glass hover-lift relative overflow-hidden rounded-2xl px-4 py-4"
      data-testid={`card-${testId}`}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-2xl border bg-white/60 text-primary dark:bg-white/5">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-medium" data-testid={`text-${testId}-title`}>
            {title}
          </div>
          <div
            className="mt-0.5 text-sm text-muted-foreground"
            data-testid={`text-${testId}-desc`}
          >
            {desc}
          </div>
        </div>
      </div>
    </div>
  );
}

function BubbleCard({ bubble }: { bubble: Bubble }) {
  const a = accentClasses(bubble.accent);

  return (
    <Card
      className="hover-lift glass group relative overflow-hidden rounded-[22px] border p-0"
      data-testid={`card-bubble-${bubble.id}`}
    >
      <div className="relative p-5">
        <div
          className={cn(
            "pointer-events-none absolute inset-0 opacity-70",
            "bg-gradient-to-br",
            a.glow,
          )}
          aria-hidden
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={cn("h-2.5 w-2.5 rounded-full", a.dot)}
                  aria-hidden
                />
                <div
                  className="font-display text-lg font-semibold tracking-tight"
                  data-testid={`text-bubble-name-${bubble.id}`}
                >
                  {bubble.name}
                </div>
              </div>
              <p
                className="mt-2 text-sm text-muted-foreground"
                data-testid={`text-bubble-desc-${bubble.id}`}
              >
                {bubble.description}
              </p>
            </div>

            <Badge
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px]",
                a.chip,
              )}
              data-testid={`badge-bubble-tags-${bubble.id}`}
            >
              {bubble.isPrivate ? "Invite-only" : "Open"}
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {bubble.tags.slice(0, 3).map((t) => (
              <Badge
                key={t}
                variant="secondary"
                className="rounded-full"
                data-testid={`badge-bubble-tag-${bubble.id}-${t}`}
              >
                {t}
              </Badge>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div
              className="text-xs text-muted-foreground"
              data-testid={`text-bubble-members-${bubble.id}`}
            >
              {bubble.members.toLocaleString()} members
            </div>
            <Button asChild size="sm" className="rounded-2xl" data-testid={`button-bubble-join-${bubble.id}`}>
              <Link href={`/bubble/${bubble.id}`}>
                Join
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EventCard({ event }: { event: EventItem }) {
  const a = accentClasses(event.accent);

  return (
    <div
      className="glass hover-lift rounded-[22px] border p-5"
      data-testid={`card-event-${event.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="font-display text-lg font-semibold tracking-tight"
            data-testid={`text-event-title-${event.id}`}
          >
            {event.title}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            <span data-testid={`text-event-bubble-${event.id}`}>{event.bubble}</span>
            <span className="px-2" aria-hidden>•</span>
            <span data-testid={`text-event-when-${event.id}`}>{event.when}</span>
          </div>
        </div>
        <Badge
          className={cn("rounded-full border px-2.5 py-0.5 text-[11px]", a.chip)}
          data-testid={`badge-event-attendees-${event.id}`}
        >
          {event.attendees} going
        </Badge>
      </div>
      <div
        className="mt-3 text-sm text-muted-foreground"
        data-testid={`text-event-location-${event.id}`}
      >
        {event.location}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", a.dot)} />
          <span data-testid={`text-event-signal-${event.id}`}>Live updates</span>
        </div>
        <Button asChild variant="secondary" size="sm" className="rounded-2xl" data-testid={`button-event-view-${event.id}`}>
          <Link href="/explore">
            View
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Composer() {
  const [text, setText] = useState("");

  return (
    <div className="glass rounded-[26px] border p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-base font-semibold" data-testid="text-composer-title">
            Share a moment
          </div>
          <div className="text-sm text-muted-foreground" data-testid="text-composer-subtitle">
            Photo + caption (prototype)
          </div>
        </div>
        <Button variant="secondary" size="sm" className="rounded-2xl" data-testid="button-upload">
          <ImagePlus className="mr-2 h-4 w-4" />
          Add photo
        </Button>
      </div>

      <div className="mt-4">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a caption\u2026"
          className="h-11 rounded-2xl"
          data-testid="input-caption"
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-muted-foreground" data-testid="text-caption-hint">
          Add tags like \"outdoor\" or \"music\".
        </div>
        <Button
          className="rounded-2xl"
          size="sm"
          disabled={!text.trim()}
          data-testid="button-post"
        >
          Post
        </Button>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user) navigate("/explore", { replace: true });
  }, [user]);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"discover" | "events" | "messages">("discover");

  const bubbles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bubblesSeed;
    return bubblesSeed.filter((b) =>
      [b.name, b.description, ...b.tags].some((x) => x.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <div className="space-y-8">
      <Hero />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="font-display text-xl font-semibold" data-testid="text-section-title">
                Discover
              </div>
              <div className="mt-1 text-sm text-muted-foreground" data-testid="text-section-subtitle">
                Nearby bubbles and events curated for you.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter bubbles\u2026"
                  className="h-11 rounded-2xl pl-9"
                  data-testid="input-filter"
                />
              </div>
              <Button variant="secondary" className="h-11 rounded-2xl" data-testid="button-filters">
                Filters
              </Button>
            </div>
          </div>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as any)}
            className="mt-5"
          >
            <TabsList className="rounded-2xl" data-testid="tabs-main">
              <TabsTrigger value="discover" className="rounded-2xl" data-testid="tab-discover">
                Bubbles
              </TabsTrigger>
              <TabsTrigger value="events" className="rounded-2xl" data-testid="tab-events">
                Events
              </TabsTrigger>
              <TabsTrigger value="messages" className="rounded-2xl" data-testid="tab-messages">
                Messages
              </TabsTrigger>
            </TabsList>

            <TabsContent value="discover" className="mt-5">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key="bubbles"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="grid gap-4 sm:grid-cols-2"
                  data-testid="grid-bubbles"
                >
                  {bubbles.map((b) => (
                    <BubbleCard key={b.id} bubble={b} />
                  ))}
                </motion.div>
              </AnimatePresence>
            </TabsContent>

            <TabsContent value="events" className="mt-5">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="grid gap-4"
                data-testid="grid-events"
              >
                {eventsSeed.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </motion.div>
            </TabsContent>

            <TabsContent value="messages" className="mt-5">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="glass rounded-[26px] border p-6"
                data-testid="panel-messages"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-lg font-semibold" data-testid="text-messages-title">
                      Messaging
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground" data-testid="text-messages-subtitle">
                      Direct + group chats (UI preview)
                    </div>
                  </div>
                  <Button className="rounded-2xl" data-testid="button-new-message">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    New
                  </Button>
                </div>

                <div className="mt-5 grid gap-3">
                  {[
                    {
                      id: "c-1",
                      title: "Film Photo Club",
                      last: "Want to meet at 10?",
                      unread: 2,
                    },
                    { id: "c-2", title: "Weekend Hikers", last: "Trail map sent.", unread: 0 },
                    { id: "c-3", title: "Studio Sessions", last: "Set list dropped.", unread: 1 },
                  ].map((c) => (
                    <button
                      key={c.id}
                      className="hover-elevate flex w-full items-center justify-between rounded-2xl border bg-white/60 px-4 py-3 text-left transition dark:bg-white/5"
                      data-testid={`button-convo-${c.id}`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium" data-testid={`text-convo-title-${c.id}`}>
                          {c.title}
                        </div>
                        <div
                          className="mt-0.5 truncate text-sm text-muted-foreground"
                          data-testid={`text-convo-last-${c.id}`}
                        >
                          {c.last}
                        </div>
                      </div>
                      {c.unread > 0 ? (
                        <Badge
                          className="rounded-full bg-primary text-primary-foreground"
                          data-testid={`badge-convo-unread-${c.id}`}
                        >
                          {c.unread}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground" data-testid={`text-convo-read-${c.id}`}>
                          Read
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-4">
          <div className="space-y-4">
            <Composer />

            <div className="glass rounded-[26px] border p-5" data-testid="panel-quick">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-base font-semibold" data-testid="text-quick-title">
                    Quick actions
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid="text-quick-subtitle">
                    Common things you'll do in a Bubble.
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {[
                  {
                    id: "qa-1",
                    label: "Create an event",
                    icon: <CalendarDays className="h-4 w-4" />,
                  },
                  {
                    id: "qa-2",
                    label: "Invite members",
                    icon: <Users className="h-4 w-4" />,
                  },
                  {
                    id: "qa-3",
                    label: "Post a photo",
                    icon: <ImagePlus className="h-4 w-4" />,
                  },
                ].map((a) => (
                  <Button
                    key={a.id}
                    variant="secondary"
                    className="h-11 justify-start rounded-2xl"
                    data-testid={`button-${a.id}`}
                  >
                    <span className="mr-2 text-muted-foreground">{a.icon}</span>
                    {a.label}
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </Button>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border bg-white/60 p-4 text-sm text-muted-foreground dark:bg-white/5" data-testid="card-privacy">
                <div className="font-medium text-foreground" data-testid="text-privacy-title">
                  Privacy controls
                </div>
                <div className="mt-1" data-testid="text-privacy-desc">
                  Public, private, invite-only, and hidden visibility options—plus role-based member management.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
