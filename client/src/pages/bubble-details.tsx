import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  ArrowDown,
  Camera,
  ChevronDown,
  Check,
  Clock,
  Crown,
  Flag,
  MessageSquare,
  MoreHorizontal,
  Plus,
  QrCode,
  Send,
  Share2,
  Star,
  Trash2,
  X,
  CalendarDays,
  Pin,
  Heart,
  LayoutDashboard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

function Segmented({ value, onChange }: { value: "details" | "events" | "bulletin"; onChange: (v: "details" | "events" | "bulletin") => void }) {
  return (
    <div className="mt-2 flex justify-center" data-testid="segmented-tabs">
      <div className="inline-flex rounded-full bg-black/5 p-1">
        {([
          { id: "details", label: "Details" },
          { id: "events", label: "Events" },
          { id: "bulletin", label: "Bulletin" },
        ] as const).map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={cn(
                "relative rounded-full px-4 py-2 text-[13px] font-semibold",
                active ? "text-foreground" : "text-muted-foreground",
              )}
              data-testid={`tab-${t.id}`}
            >
              {t.label}
              {active ? (
                <span
                  className="absolute left-1/2 top-full mt-1 h-[2px] w-10 -translate-x-1/2 rounded-full"
                  style={{ background: "linear-gradient(90deg, #35A8F7, #6C63FF)" }}
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

function JoinBubbleSheet({
  bubble,
  onClose,
  onJoin,
}: {
  bubble: Bubble;
  onClose: () => void;
  onJoin: () => void;
}) {
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  const allConfirmed = useMemo(() => {
    return bubble.rules.every((_, idx) => Boolean(confirmed[String(idx)]));
  }, [bubble.rules, confirmed]);

  return (
    <div className="min-h-dvh bg-black/40 text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-end">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="relative rounded-t-[28px] bg-background px-5 pb-6 pt-4 shadow-[0_-20px_60px_rgba(0,0,0,0.18)]"
          data-testid="sheet-join"
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/10" />

          <button
            onClick={onClose}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 ring-1 ring-black/5"
            data-testid="button-join-close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="text-center">
            <div className="font-display text-[22px] font-semibold leading-tight" data-testid="text-join-title">
              Welcome to {bubble.title}
            </div>
            <div className="mt-1 text-[12px] font-semibold text-muted-foreground" data-testid="text-join-category">
              {bubble.category}
            </div>
          </div>

          <div className="mt-5 border-t border-black/10 pt-4">
            <div className="text-[13px] font-semibold" data-testid="text-rules-title">
              Bubble Rules
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground" data-testid="text-rules-subtitle">
              Tap each rule to confirm
            </div>

            <div className="mt-4 space-y-3" data-testid="list-rules">
              {bubble.rules.map((rule, idx) => {
                const key = String(idx);
                const isOn = Boolean(confirmed[key]);
                return (
                  <button
                    key={key}
                    onClick={() => setConfirmed((p) => ({ ...p, [key]: !p[key] }))}
                    className="flex w-full items-start gap-3 rounded-2xl bg-white/55 px-3 py-3 ring-1 ring-black/5"
                    data-testid={`rule-${idx}`}
                  >
                    <div
                      className={cn(
                        "mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-lg",
                        isOn ? "bg-emerald-500" : "bg-black/10",
                      )}
                      data-testid={`rule-check-${idx}`}
                    >
                      {isOn ? <Check className="h-4 w-4 text-white" /> : null}
                    </div>
                    <div className="min-w-0 text-left text-[13px] leading-snug text-foreground/90" data-testid={`rule-text-${idx}`}>
                      {rule}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 border-t border-black/10 pt-4">
            <div className="text-[13px] font-semibold" data-testid="text-next-steps-title">
              Next Steps
            </div>

            <div className="mt-3 space-y-3" data-testid="list-next-steps">
              <div className="flex items-start gap-3" data-testid="step-introduce">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold">Introduce Yourself</div>
                  <div className="mt-1 text-[12px] leading-snug text-muted-foreground">
                    Say hi in the group chat — everyone’s friendly.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="step-rsvp">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--brand-2))]/12 text-[hsl(var(--brand-2))]">
                  <span className="text-[16px] font-bold" aria-hidden>
                    ◎
                  </span>
                </div>
                <div>
                  <div className="text-[13px] font-semibold">RSVP to an Upcoming Event</div>
                  <div className="mt-1 text-[12px] leading-snug text-muted-foreground" data-testid="text-next-event">
                    Next event: Smash Social — Today at 6:00 PM
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Button
              disabled={!allConfirmed}
              onClick={onJoin}
              className="h-12 w-full rounded-full text-[14px] font-semibold shadow-[0_18px_55px_hsl(var(--primary)/0.30)] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
              data-testid="button-join-letsgo"
            >
              Let’s go
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function ReportModal({ open, onClose, title }: { open: boolean; onClose: () => void; title: string }) {
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const submit = () => {
    if (!reason.trim()) return;
    setSent(true);
    setTimeout(() => { onClose(); setSent(false); setReason(""); }, 1500);
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Describe the issue and our team will review it.</DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Check className="h-10 w-10 text-emerald-500" />
            <div className="font-semibold text-black/70">Report submitted</div>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What's going on?"
              rows={4}
              className="w-full resize-none rounded-xl border border-black/10 bg-[#FAFAFA] px-3 py-2.5 text-[13px] outline-none"
            />
            <button
              onClick={submit}
              className="h-11 w-full rounded-2xl text-[14px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #35A8F7, #6C63FF)" }}
            >
              Submit Report
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BubbleKebabMenu({
  bubble,
  isMember,
  isAdmin,
  onManage,
  onChat,
}: {
  bubble: Bubble;
  isMember: boolean;
  isAdmin: boolean;
  onManage: () => void;
  onChat: () => void;
}) {
  const [reportConcern, setReportConcern] = useState(false);
  const [reportBubble, setReportBubble] = useState(false);
  const RED = "#E8453C";
  const BLUE = "#35A8F7";

  const share = () => {
    const url = `${window.location.origin}/bubble/${bubble.id}`;
    if (navigator.share) {
      navigator.share({ title: bubble.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5 backdrop-blur"
            data-testid="button-bubble-kebab"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 rounded-2xl border-0 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.14)]"
        >
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-normal text-black"
            onClick={share}
            data-testid="action-share-bubble"
          >
            <Share2 className="h-[18px] w-[18px] text-black/60" />
            Share Bubble
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-normal text-black"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/bubble/${bubble.id}`)}
            data-testid="action-qr-bubble"
          >
            <QrCode className="h-[18px] w-[18px] text-black/60" />
            QR Code
          </DropdownMenuItem>

          {isMember && (
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-normal text-black"
              onClick={onChat}
              data-testid="action-bubble-chat"
            >
              <MessageSquare className="h-[18px] w-[18px] text-black/60" />
              Bubble Chat
            </DropdownMenuItem>
          )}

          {isAdmin && (
            <>
              <DropdownMenuSeparator className="my-1 bg-black/6" />
              <DropdownMenuItem
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-normal"
                style={{ color: BLUE }}
                onClick={onManage}
                data-testid="action-manage-bubble"
              >
                <Crown className="h-[18px] w-[18px]" style={{ color: BLUE }} />
                Manage Bubble
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator className="my-1 bg-black/6" />

          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-normal text-black"
            onClick={() => setReportConcern(true)}
            data-testid="action-report-concern"
          >
            <Flag className="h-[18px] w-[18px]" style={{ color: RED }} />
            Report a Concern
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-black/6" />

          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-normal"
            style={{ color: RED }}
            onClick={() => setReportBubble(true)}
            data-testid="action-report-bubble"
          >
            <Flag className="h-[18px] w-[18px]" style={{ color: RED }} />
            Report this Bubble
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportModal open={reportConcern} onClose={() => setReportConcern(false)} title="Report a Concern" />
      <ReportModal open={reportBubble} onClose={() => setReportBubble(false)} title="Report this Bubble" />
    </>
  );
}

function MemberKebabMenu({ member }: { member: Member }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-2 text-muted-foreground" data-testid={`button-member-more-${member.id}`}>
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          className="gap-2"
          data-testid={`action-dm-${member.id}`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Direct Message</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-red-500 focus:text-red-500"
          data-testid={`action-remove-${member.id}`}
        >
          <Trash2 className="h-4 w-4" />
          <span>Remove from group</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {member.role === "admin" ? (
          <DropdownMenuItem
            className="gap-2 text-amber-500 focus:text-amber-500"
            data-testid={`action-demote-${member.id}`}
          >
            <ArrowDown className="h-4 w-4" />
            <span>Demote</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="gap-2 text-green-600 focus:text-green-600"
            data-testid={`action-make-admin-${member.id}`}
          >
            <Star className="h-4 w-4" />
            <span>Make admin</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-red-500 focus:text-red-500"
          data-testid={`action-report-${member.id}`}
        >
          <Flag className="h-4 w-4" />
          <span>Report a concern</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
              <MemberKebabMenu member={m} />
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
              <MemberKebabMenu member={m} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BubbleDetails() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"details" | "events" | "bulletin">("details");
  const [sectionAbout, setSectionAbout] = useState(true);
  const [sectionAttachments, setSectionAttachments] = useState(false);
  const [view, setView] = useState<"bubble" | "members" | "join">("bubble");

  const id = useMemo(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }, []);

  const { data: bubbleData, isLoading: bubbleLoading } = useQuery<any>({
    queryKey: [`/api/bubbles/${id}`],
    queryFn: () => fetch(`/api/bubbles/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const { data: membershipData, refetch: refetchMembership } = useQuery<any>({
    queryKey: [`/api/bubbles/${id}/membership`],
    queryFn: () => apiRequest("GET", `/api/bubbles/${id}/membership`).then((r) => r.json()),
    enabled: !!id && !!user,
    retry: false,
  });

  const { data: rulesData } = useQuery<any[]>({
    queryKey: [`/api/rules/effective/${id}`],
    queryFn: () => fetch(`/api/rules/effective/${id}`).then((r) => r.json()),
    enabled: !!id && view === "join",
  });

  const { data: bubbleEvents } = useQuery<any[]>({
    queryKey: [`/api/bubbles/${id}/events`],
    queryFn: () => fetch(`/api/bubbles/${id}/events`).then((r) => r.json()),
    enabled: !!id && tab === "events",
  });

  const { data: bulletinPosts } = useQuery<any[]>({
    queryKey: [`/api/bubbles/${id}/bulletin/posts`],
    queryFn: () => apiRequest("GET", `/api/bubbles/${id}/bulletin/posts`).then((r) => r.json()),
    enabled: !!id && !!user && tab === "bulletin",
  });

  const joinMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/bubbles/${id}/join`).then((r) => r.json()),
    onSuccess: () => {
      refetchMembership();
      qc.invalidateQueries({ queryKey: [`/api/bubbles/${id}`] });
      setView("bubble");
    },
  });

  const isMember = membershipData?.isMember === true || membershipData?.membershipStatus === "approved";
  const isPending = !isMember && membershipData?.membershipStatus === "pending";
  const isAdmin = membershipData?.role === "admin" || user?.isSuperAdmin === true;

  const bubble: Bubble = useMemo(() => {
    if (!bubbleData || bubbleData.error) {
      return { id, title: "...", category: "", tagline: "", image: "", members: 0, isActiveMember: false, about: "", rules: [] };
    }
    const effectiveRules: string[] = Array.isArray(rulesData)
      ? rulesData.filter((r: any) => r.isVisible !== false).map((r: any) => r.text ?? r.rule ?? String(r))
      : (bubbleData.rules ?? []);
    const img = (bubbleData.images && bubbleData.images[0]) || bubbleData.coverImage || "";
    return {
      id: bubbleData.id,
      title: bubbleData.title ?? "",
      category: bubbleData.category ?? "",
      tagline: bubbleData.tagline ?? "",
      image: img,
      members: bubbleData.members ?? 0,
      isActiveMember: isMember,
      about: bubbleData.description ?? "",
      rules: effectiveRules,
    };
  }, [bubbleData, rulesData, isMember, id]);

  if (view === "members") {
    return <MembersScreen onBack={() => setView("bubble")} />;
  }

  if (view === "join") {
    if (!user) {
      navigate("/auth");
      return null;
    }
    return (
      <JoinBubbleSheet
        bubble={bubble}
        onClose={() => setView("bubble")}
        onJoin={() => joinMutation.mutate()}
      />
    );
  }

  if (bubbleLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background" data-testid="loading-bubble">
        <div className="text-[13px] text-muted-foreground">Loading...</div>
      </div>
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
          <BubbleKebabMenu
            bubble={bubble}
            isMember={isMember}
            isAdmin={isAdmin}
            onChat={() => { window.location.href = `/chat/chat-${bubble.id}`; }}
            onManage={() => navigate("/admin/pending")}
          />
        </div>
        <Segmented value={tab} onChange={setTab} />
      </div>

      <div className="mx-auto w-full max-w-[420px] px-5 pb-28 pt-4">
        {tab === "details" ? (
          <>
            {/* Admin Dashboard entry point */}
            {isAdmin && (
              <button
                onClick={() => navigate("/admin/pending")}
                className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/8"
                data-testid="button-admin-dashboard"
              >
                <div
                  className="grid h-9 w-9 place-items-center rounded-xl"
                  style={{ background: "linear-gradient(135deg, #35A8F7, #6C63FF)" }}
                >
                  <LayoutDashboard className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-[13px] font-semibold text-black">Admin Dashboard</div>
                  <div className="text-[11px] text-black/40">Manage members, events & content</div>
                </div>
                <span className="text-[12px] font-semibold" style={{ color: "#35A8F7" }}>Manage →</span>
              </button>
            )}

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
                  <span className={cn("h-2 w-2 rounded-full", bubble.isActiveMember ? "bg-emerald-500" : isPending ? "bg-amber-400" : "bg-black/20")} />
                  <span className="font-semibold text-muted-foreground">
                    {bubble.isActiveMember ? "Active Member" : isPending ? "Request Pending" : "Not a member"}
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
              {bubble.isActiveMember ? (
                <>
                  <PrimaryAction label="Contact" tone="neutral" testId="button-contact" />
                  <PrimaryAction label="More" tone="neutral" testId="button-more" />
                  <PrimaryAction label="Leave Bubble" tone="danger" testId="button-leave-bubble" />
                </>
              ) : isPending ? (
                <>
                  <PrimaryAction label="Request Pending" tone="neutral" testId="button-join-pending" />
                  <PrimaryAction label="More" tone="neutral" testId="button-more" />
                </>
              ) : (
                <>
                  <PrimaryAction
                    label={bubble.category ? (bubbleData?.privacy === "Request to Join" ? "Request to Join" : "Join Bubble") : "Join Bubble"}
                    tone="primary"
                    onClick={() => setView("join")}
                    testId="button-join-bubble"
                  />
                  <PrimaryAction label="More" tone="neutral" testId="button-more" />
                </>
              )}
            </div>
          </>
        ) : tab === "events" ? (
          <div className="space-y-4" data-testid="events-tab">
            {isAdmin && (
              <button
                onClick={() => navigate("/create-event")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #35A8F7, #6C63FF)" }}
                data-testid="button-create-event"
              >
                <Plus className="h-4 w-4" /> Create Event
              </button>
            )}
            {(bubbleEvents ?? []).length === 0 ? (
              <div className="mt-4 rounded-2xl border border-black/10 bg-white/55 p-8 text-center" data-testid="empty-events">
                <CalendarDays className="mx-auto h-8 w-8 text-black/15" />
                <div className="mt-3 text-[13px] font-semibold text-black/50">No events yet</div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  Events will show up here once the host schedules something.
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                {(bubbleEvents ?? []).map((ev: any) => (
                  <div
                    key={ev.id}
                    className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/6"
                    data-testid={`row-event-${ev.id}`}
                  >
                    {ev.coverImage && (
                      <img src={ev.coverImage} alt="" className="h-16 w-16 rounded-xl object-cover shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-black">{ev.title}</div>
                      {ev.date && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-black/45">
                          <CalendarDays className="h-3 w-3" />
                          {ev.date}
                          {ev.startTime && (
                            <><Clock className="ml-1 h-3 w-3" />{ev.startTime}</>
                          )}
                        </div>
                      )}
                      {ev.locationName && (
                        <div className="mt-0.5 text-[11px] text-black/40">{ev.locationName}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Bulletin Board tab */
          <div className="space-y-4" data-testid="bulletin-tab">
            {isAdmin && (
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #35A8F7, #6C63FF)" }}
                data-testid="button-create-bulletin-post"
              >
                <Plus className="h-4 w-4" /> New Post
              </button>
            )}
            {!user ? (
              <div className="mt-4 rounded-2xl border border-black/10 bg-white/55 p-8 text-center">
                <div className="text-[13px] font-semibold text-black/50">Sign in to view the bulletin board</div>
              </div>
            ) : (bulletinPosts ?? []).length === 0 ? (
              <div className="mt-4 rounded-2xl border border-black/10 bg-white/55 p-8 text-center" data-testid="empty-bulletin">
                <Pin className="mx-auto h-8 w-8 text-black/15" />
                <div className="mt-3 text-[13px] font-semibold text-black/50">No posts yet</div>
                <div className="mt-1 text-[12px] text-muted-foreground">Admins will post announcements here.</div>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                {(bulletinPosts ?? []).map((post: any) => (
                  <div
                    key={post.id}
                    className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/6"
                    data-testid={`post-${post.id}`}
                  >
                    {post.isPinned && (
                      <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#35A8F7" }}>
                        <Pin className="h-3 w-3" /> Pinned
                      </div>
                    )}
                    <div className="text-[14px] font-semibold text-black">{post.title}</div>
                    <div className="mt-1.5 text-[13px] leading-relaxed text-black/60">{post.body}</div>
                    {post.imageUrl && (
                      <img src={post.imageUrl} alt="" className="mt-3 w-full rounded-xl object-cover" />
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <button className="flex items-center gap-1 text-[11px] text-black/40">
                        <Heart className="h-3.5 w-3.5" />
                        {post.reactionCount ?? 0}
                      </button>
                      <span className="text-[11px] text-black/30">
                        {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
