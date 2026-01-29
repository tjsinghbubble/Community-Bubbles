import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  Check,
  MessageSquare,
  MoreHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import avatar1 from "@/assets/images/avatar-1.jpg";
import avatar2 from "@/assets/images/avatar-2.jpg";
import avatar3 from "@/assets/images/avatar-3.jpg";

import pickleballImg from "@/assets/images/explore-pickleball.jpg";
import wellnessImg from "@/assets/images/explore-wellness.jpg";
import dogImg from "@/assets/images/explore-dog.jpg";
import meetupImg from "@/assets/images/explore-meetup.jpg";
import gamesImg from "@/assets/images/explore-games.jpg";
import foodImg from "@/assets/images/explore-food.jpg";

type Bubble = {
  id: string;
  title: string;
  category: string;
  tagline: string;
  image: string;
  members: number;
  isActiveMember: boolean;
  about: string;
  rules: string[];
};

const bubbleSeed: Record<string, Bubble> = {
  "sf-pickleball": {
    id: "sf-pickleball",
    title: "SF Pickleball Crew",
    category: "Team Sports",
    tagline: "Play pickleball with only\nSan Francisco locals",
    image: pickleballImg,
    members: 20,
    isActiveMember: true,
    about:
      "Looking for a fun, low-pressure way to stay active and meet people in San Francisco? This bubble is for local pickleball players of all skill levels — from first-time dinks to seasoned slammers. We host casual games, friendly tournaments, and drop-in nights. Just bring a paddle and good vibes.",
    rules: [
      "Be respectful. Treat everyone with kindness — on and off the court.",
      "RSVP honestly. Can’t make it? Update your status so others can plan.",
      "All levels welcome. Beginners, pros, and in-between — we’re here to play, not to judge.",
      "Keep it local. This bubble is for SF neighbors who want to connect IRL.",
      "Respect the space. Clean up after games and be chill with park staff.",
    ],
  },
  "mindful-mamas": {
    id: "mindful-mamas",
    title: "Mindful Mamas",
    category: "Wellness",
    tagline: "Gentle movement +\nreal talk",
    image: wellnessImg,
    members: 48,
    isActiveMember: false,
    about:
      "A calm space for moms to reset together. Breathwork, light movement, and supportive chats — no judgment, just community.",
    rules: [
      "Assume good intent. Keep conversations supportive.",
      "No medical advice — share experiences, not diagnoses.",
      "Keep it private. Don’t share other members’ stories outside the bubble.",
      "Be on time when you RSVP to meetups.",
      "Keep it local and welcoming.",
    ],
  },
  "bark-dogpatch": {
    id: "bark-dogpatch",
    title: "Bark at Dogpatch",
    category: "Animals",
    tagline: "Corgis, mutts, and\npark hangs",
    image: dogImg,
    members: 112,
    isActiveMember: true,
    about:
      "Meet up for dog park hangs, walks, and the occasional costume parade. Leash etiquette required. Treats encouraged.",
    rules: [
      "Leash etiquette first. Keep pups safe.",
      "No aggressive behavior — remove your dog if needed.",
      "Pick up after your pup. Always.",
      "Ask before feeding treats.",
      "Be friendly to humans too.",
    ],
  },
  "marina-meetup": {
    id: "marina-meetup",
    title: "Marina Meetup",
    category: "Neighborhood",
    tagline: "Neighbors who\nactually hang",
    image: meetupImg,
    members: 67,
    isActiveMember: false,
    about:
      "Low-key local meetups: coffee strolls, sunset chats, and spontaneous plans. Say hi, bring a friend.",
    rules: [
      "Be kind and inclusive.",
      "No spam or self-promo without asking.",
      "Respect personal boundaries.",
      "Keep plans local.",
      "If you RSVP, show up — or update early.",
    ],
  },
  "park-picnic": {
    id: "park-picnic",
    title: "Park Picnic & Cards",
    category: "Games",
    tagline: "Picnic blanket\ntraditions",
    image: gamesImg,
    members: 31,
    isActiveMember: true,
    about:
      "Cards, snacks, and easy laughs. We rotate parks weekly and keep games beginner-friendly.",
    rules: [
      "Be chill. This is low-stakes fun.",
      "Bring something to share if you can.",
      "No loud speakers.",
      "Respect the park — leave it cleaner than you found it.",
      "Teach games kindly to newcomers.",
    ],
  },
  "food-finds": {
    id: "food-finds",
    title: "Food Finds",
    category: "Food",
    tagline: "New spots,\nbetter bites",
    image: foodImg,
    members: 84,
    isActiveMember: false,
    about:
      "Try new restaurants and keep a running list of local favorites. Meetups are optional, recommendations are not.",
    rules: [
      "Be respectful with reviews.",
      "No doxxing or call-outs.",
      "Support local businesses.",
      "Keep recommendations honest.",
      "Be kind to service staff.",
    ],
  },
};

type Member = { id: string; name: string; avatar: string; role: "admin" | "participant" };

const membersSeed: Member[] = [
  { id: "a-1", name: "Alexa Garcia", avatar: avatar1, role: "admin" },
  { id: "a-2", name: "Blake Jenson", avatar: avatar2, role: "admin" },
  { id: "a-3", name: "Brandon Nash", avatar: avatar3, role: "admin" },
  { id: "p-1", name: "John Doe", avatar: avatar2, role: "participant" },
  { id: "p-2", name: "Hermione Granger", avatar: avatar1, role: "participant" },
  { id: "p-3", name: "John Doe", avatar: avatar2, role: "participant" },
  { id: "p-4", name: "Hermione Granger", avatar: avatar1, role: "participant" },
  { id: "p-5", name: "John Doe", avatar: avatar2, role: "participant" },
  { id: "p-6", name: "Hermione Granger", avatar: avatar1, role: "participant" },
  { id: "p-7", name: "John Doe", avatar: avatar2, role: "participant" },
  { id: "p-8", name: "Hermione Granger", avatar: avatar1, role: "participant" },
];

function Segmented({ value, onChange }: { value: "details" | "events"; onChange: (v: "details" | "events") => void }) {
  return (
    <div className="mt-2 flex justify-center" data-testid="segmented-tabs">
      <div className="inline-flex rounded-full bg-black/5 p-1">
        {([
          { id: "details", label: "Details" },
          { id: "events", label: "Events" },
        ] as const).map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={cn(
                "relative rounded-full px-5 py-2 text-[13px] font-semibold",
                active ? "text-foreground" : "text-muted-foreground",
              )}
              data-testid={`tab-${t.id}`}
            >
              {t.label}
              {active ? (
                <span
                  className="absolute left-1/2 top-full mt-1 h-[2px] w-10 -translate-x-1/2 rounded-full"
                  style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CollapsibleRow({
  title,
  open,
  onToggle,
  children,
  testId,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <div className="border-t border-black/10" data-testid={testId}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4"
        data-testid={`${testId}-toggle`}
      >
        <div className="text-[13px] font-semibold text-muted-foreground" data-testid={`${testId}-title`}>
          {title}
        </div>
        <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden px-5 pb-4"
            data-testid={`${testId}-content`}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MembersRow({ members, onView }: { members: number; onView: () => void }) {
  return (
    <button
      onClick={onView}
      className="flex w-full items-center justify-between px-5 py-4"
      data-testid="row-members"
    >
      <div className="text-[13px] font-semibold text-muted-foreground" data-testid="text-members-count">
        {members} Members
      </div>
      <div className="text-[13px] font-semibold text-[hsl(var(--primary))]" data-testid="link-members-view">
        view
      </div>
    </button>
  );
}

function PrimaryAction({
  label,
  tone,
  onClick,
  testId,
}: {
  label: string;
  tone: "neutral" | "danger" | "primary";
  onClick?: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-12 w-full rounded-2xl text-[14px] font-semibold",
        tone === "danger"
          ? "border border-red-400/60 bg-white text-red-500"
          : tone === "primary"
            ? "text-white shadow-[0_18px_55px_hsl(var(--primary)/0.30)]"
            : "bg-black/40 text-white",
      )}
      style={
        tone === "primary"
          ? { background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }
          : undefined
      }
      data-testid={testId}
    >
      {label}
    </button>
  );
}

function MembersScreen({ onBack }: { onBack: () => void }) {
  const admins = membersSeed.filter((m) => m.role === "admin");
  const participants = membersSeed.filter((m) => m.role === "participant");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="sticky top-0 z-20 bg-background/85 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={onBack}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5 backdrop-blur"
            data-testid="button-members-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-[15px] font-semibold tracking-tight" data-testid="text-members-title">
            Members
          </div>
          <div className="h-10 w-10" aria-hidden />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[420px] px-5 pb-8 pt-2">
        <div className="mt-2 text-[12px] font-semibold text-muted-foreground" data-testid="text-admins-title">
          Admins
        </div>
        <div className="mt-3 space-y-1">
          {admins.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between border-b border-black/10 py-3"
              data-testid={`row-admin-${m.id}`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={m.avatar}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                  data-testid={`img-admin-${m.id}`}
                />
                <div className="text-[13px] font-semibold" data-testid={`text-admin-name-${m.id}`}>
                  {m.name}
                </div>
              </div>
              <button className="p-2 text-muted-foreground" data-testid={`button-admin-more-${m.id}`}>
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 text-[12px] font-semibold text-muted-foreground" data-testid="text-participants-title">
          Participants
        </div>
        <div className="mt-3 space-y-1">
          {participants.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between border-b border-black/10 py-3"
              data-testid={`row-participant-${m.id}`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={m.avatar}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                  data-testid={`img-participant-${m.id}`}
                />
                <div className="text-[13px] font-semibold" data-testid={`text-participant-name-${m.id}`}>
                  {m.name}
                </div>
              </div>
              <button className="p-2 text-muted-foreground" data-testid={`button-participant-more-${m.id}`}>
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BubbleDetails() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"details" | "events">("details");
  const [sectionAbout, setSectionAbout] = useState(true);
  const [sectionAttachments, setSectionAttachments] = useState(false);
  const [view, setView] = useState<"bubble" | "members" | "join">("bubble");

  const id = useMemo(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last || "sf-pickleball";
  }, []);

  const bubble = bubbleSeed[id] ?? bubbleSeed["sf-pickleball"];

  if (view === "members") {
    return <MembersScreen onBack={() => setView("bubble")} />;
  }

  if (view === "join") {
    return (
      <JoinBubbleSheet
        bubble={bubble}
        onClose={() => setView("bubble")}
        onJoin={() => {
          bubble.isActiveMember = true;
          setView("bubble");
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="sticky top-0 z-20 bg-background/85 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={() => navigate("/explore")}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5 backdrop-blur"
            data-testid="button-bubble-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-[15px] font-semibold tracking-tight" data-testid="text-bubble-title">
            {bubble.title}
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5 backdrop-blur"
            data-testid="button-bubble-chat"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        </div>
        <Segmented value={tab} onChange={setTab} />
      </div>

      <div className="mx-auto w-full max-w-[420px] px-5 pb-28 pt-4">
        {tab === "details" ? (
          <>
            <Card className="overflow-hidden rounded-[30px] border-0 bg-white/55 shadow-sm ring-1 ring-black/5">
              <div className="relative aspect-[4/3]">
                <img
                  src={bubble.image}
                  alt=""
                  className="h-full w-full object-cover"
                  data-testid="img-bubble-hero"
                />
                <button
                  className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/75 text-foreground/70 shadow-sm ring-1 ring-black/10 backdrop-blur"
                  data-testid="button-bubble-camera"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
              <div className="px-5 pb-5 pt-4">
                <div
                  className="text-center font-display text-[20px] font-semibold leading-tight tracking-tight"
                  data-testid="text-bubble-tagline"
                >
                  {bubble.tagline}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 text-[12px]" data-testid="row-active-member">
                  <span className={cn("h-2 w-2 rounded-full", bubble.isActiveMember ? "bg-emerald-500" : "bg-black/20")} />
                  <span className="font-semibold text-muted-foreground">
                    {bubble.isActiveMember ? "Active Member" : "Not a member"}
                  </span>
                </div>
              </div>
            </Card>

            <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-white/55">
              <CollapsibleRow
                title="About"
                open={sectionAbout}
                onToggle={() => setSectionAbout((v) => !v)}
                testId="section-about"
              >
                <div className="text-[12px] leading-relaxed text-muted-foreground" data-testid="text-about">
                  {bubble.about}
                </div>
              </CollapsibleRow>
              <CollapsibleRow
                title="Attachments"
                open={sectionAttachments}
                onToggle={() => setSectionAttachments((v) => !v)}
                testId="section-attachments"
              >
                <div className="text-[12px] text-muted-foreground" data-testid="text-attachments">
                  No attachments yet.
                </div>
              </CollapsibleRow>

              <div className="border-t border-black/10">
                <MembersRow members={bubble.members} onView={() => setView("members")} />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <PrimaryAction label="Contact" tone="neutral" />
              <PrimaryAction label="More" tone="neutral" />
              <PrimaryAction label="Leave Bubble" tone="danger" />
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-black/10 bg-white/55 p-6 text-center" data-testid="empty-events">
            <div className="text-[13px] font-semibold">No events yet</div>
            <div className="mt-2 text-[12px] text-muted-foreground">
              Events will show up here once the host schedules something.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
