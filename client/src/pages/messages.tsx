import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  CheckCheck,
  ImagePlus,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import avatar1 from "@/assets/images/avatar-1.jpg";
import avatar2 from "@/assets/images/avatar-2.jpg";
import avatar3 from "@/assets/images/avatar-3.jpg";

type ChatId = string;

type Chat = {
  id: ChatId;
  bubbleId: string;
  title: string;
  subtitle: string;
  avatar: string;
  muted?: boolean;
  pinned?: boolean;
};

type MessageType = "text" | "image" | "system";

type Message = {
  id: string;
  chatId: ChatId;
  from: "me" | "other";
  authorName?: string;
  type: MessageType;
  text?: string;
  imageUrl?: string;
  ts: number;
  status?: "sending" | "sent" | "delivered" | "read";
  replyTo?: { id: string; preview: string; from: "me" | "other" };
  starred?: boolean;
};

type Draft = {
  text: string;
  replyTo?: Message["replyTo"];
  editingId?: string;
};

const LS_CHATS = "bubble:chats:v1";
const LS_MESSAGES = "bubble:messages:v1";
const LS_UNREAD = "bubble:unread:v1";
const LS_JOINED_PREFIX = "bubble:joined:";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function softHaptic() {
  // UI-only mock
}

function pillGradientStyle() {
  return { background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" };
}

function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[420px] items-center justify-between px-5 py-4">
        {onBack ? (
          <button
            onClick={onBack}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5 backdrop-blur"
            data-testid="button-nav-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="h-10 w-10" aria-hidden />
        )}

        <div className="min-w-0 text-center">
          <div className="truncate text-[15px] font-semibold tracking-tight" data-testid="text-nav-title">
            {title}
          </div>
        </div>

        <div className="flex h-10 w-10 items-center justify-end">{right}</div>
      </div>
    </div>
  );
}

function EmptyState({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[420px] px-5 pb-28 pt-6">
      <div className="rounded-[26px] bg-white/55 p-6 text-center ring-1 ring-black/5">
        <div className="text-[14px] font-semibold" data-testid="text-empty-title">
          No chats yet
        </div>
        <div className="mt-2 text-[12px] leading-relaxed text-muted-foreground" data-testid="text-empty-subtitle">
          Join a Bubble to unlock its group chat. Your chats will appear here.
        </div>
        <div className="mt-5">
          <Button
            onClick={onExplore}
            className="h-11 rounded-full px-6 text-[13px] font-semibold"
            style={pillGradientStyle()}
            data-testid="button-empty-explore"
          >
            Explore Bubbles
          </Button>
        </div>
      </div>
    </div>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div
      className="grid min-w-[22px] place-items-center rounded-full bg-[hsl(var(--primary))] px-1.5 py-0.5 text-[11px] font-bold text-white"
      data-testid="badge-unread"
    >
      {count > 99 ? "99+" : count}
    </div>
  );
}

function BottomNav({ active, onSelect, unreadTotal }: { active: "explore" | "messages"; onSelect: (id: string) => void; unreadTotal: number }) {
  const items = [
    { id: "explore", label: "Explore" },
    { id: "upcoming", label: "Upcoming" },
    { id: "bubbles", label: "Bubbles" },
    { id: "messages", label: "Messages" },
    { id: "profile", label: "Profile" },
  ] as const;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
      <div className="pointer-events-auto w-full max-w-[420px] px-4 pb-4">
        <div className="rounded-[26px] bg-white/70 px-3 py-2 shadow-[0_18px_60px_hsl(var(--foreground)/0.18)] ring-1 ring-black/5 backdrop-blur">
          <div className="grid grid-cols-5 gap-1">
            {items.map((it) => {
              const isActive = it.id === active;
              return (
                <button
                  key={it.id}
                  onClick={() => onSelect(it.id)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-medium",
                    isActive ? "text-[hsl(var(--primary))]" : "text-muted-foreground",
                  )}
                  data-testid={`tab-${it.id}`}
                >
                  <div
                    className={cn(
                      "h-5 w-5 rounded-md",
                      isActive ? "bg-[hsl(var(--primary))]/15" : "bg-black/5",
                    )}
                    aria-hidden
                  />
                  {it.id === "messages" ? (
                    <div className="absolute right-3 top-1.5" data-testid="badge-messages-unread">
                      <UnreadBadge count={unreadTotal} />
                    </div>
                  ) : null}
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatRow({
  chat,
  unread,
  onOpen,
}: {
  chat: Chat;
  unread: number;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl bg-white/50 px-3 py-3 ring-1 ring-black/5"
      data-testid={`row-chat-${chat.id}`}
    >
      <img
        src={chat.avatar}
        alt=""
        className="h-12 w-12 rounded-2xl object-cover"
        data-testid={`img-chat-${chat.id}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-[13px] font-semibold" data-testid={`text-chat-title-${chat.id}`}>
            {chat.title}
          </div>
          <UnreadBadge count={unread} />
        </div>
        <div className="mt-0.5 truncate text-[12px] text-muted-foreground" data-testid={`text-chat-subtitle-${chat.id}`}>
          {chat.subtitle}
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground" data-testid={`text-chat-time-${chat.id}`}>
        {format(Date.now() - 1000 * 60 * 12, "h:mm a")}
      </div>
    </button>
  );
}

function Bubble({ from }: { from: "me" | "other" }) {
  return from === "me" ? (
    <div className="rounded-2xl rounded-tr-md bg-[hsl(var(--primary))]/12 px-3 py-2 ring-1 ring-[hsl(var(--primary))]/20" />
  ) : (
    <div className="rounded-2xl rounded-tl-md bg-white/70 px-3 py-2 ring-1 ring-black/5" />
  );
}

function StatusTicks({ status }: { status?: Message["status"] }) {
  if (!status || status === "sending") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" data-testid="status-sending">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-black/30" />
      </span>
    );
  }
  if (status === "sent") {
    return <Check className="h-3.5 w-3.5 text-muted-foreground" data-testid="status-sent" />;
  }
  if (status === "delivered") {
    return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" data-testid="status-delivered" />;
  }
  return <CheckCheck className="h-3.5 w-3.5 text-[hsl(var(--primary))]" data-testid="status-read" />;
}

function ReactionPill({ emoji, onClick, active }: { emoji: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-2 py-1 text-[13px] ring-1 ring-black/10",
        active ? "bg-white" : "bg-white/70",
      )}
      data-testid={`reaction-${emoji}`}
    >
      {emoji}
    </button>
  );
}

function MessageBubble({
  msg,
  showName,
  onReply,
  onToggleStar,
  onCopy,
  onDelete,
  onEdit,
  onReact,
}: {
  msg: Message;
  showName: boolean;
  onReply: () => void;
  onToggleStar: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReact: (emoji: string) => void;
}) {
  const mine = msg.from === "me";

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")} data-testid={`message-${msg.id}`}>
      <div className={cn("max-w-[82%]", mine ? "pl-8" : "pr-8")}>
        {msg.type === "system" ? (
          <div className="mx-auto w-fit rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold text-muted-foreground" data-testid={`system-${msg.id}`}>
            {msg.text}
          </div>
        ) : (
          <div className={cn("relative")}
          >
            <div
              className={cn(
                "overflow-hidden",
                mine
                  ? "rounded-2xl rounded-tr-md bg-[hsl(var(--primary))]/12 ring-1 ring-[hsl(var(--primary))]/20"
                  : "rounded-2xl rounded-tl-md bg-white/70 ring-1 ring-black/5",
              )}
            >
              {showName && !mine ? (
                <div className="px-3 pt-2 text-[11px] font-semibold text-[hsl(var(--primary))]" data-testid={`text-author-${msg.id}`}>
                  {msg.authorName}
                </div>
              ) : null}

              {msg.replyTo ? (
                <div className={cn("mx-3 mt-2 rounded-xl px-2 py-2", mine ? "bg-white/60" : "bg-black/5")}
                  data-testid={`reply-preview-${msg.id}`}
                >
                  <div className="text-[10px] font-semibold text-muted-foreground">
                    Replying to {msg.replyTo.from === "me" ? "you" : "someone"}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                    {msg.replyTo.preview}
                  </div>
                </div>
              ) : null}

              {msg.type === "image" && msg.imageUrl ? (
                <img
                  src={msg.imageUrl}
                  alt=""
                  className="h-44 w-full object-cover"
                  data-testid={`img-message-${msg.id}`}
                />
              ) : null}

              {msg.text ? (
                <div className={cn("px-3 py-2 text-[13px] leading-snug", mine ? "text-foreground" : "text-foreground")}
                  data-testid={`text-message-${msg.id}`}
                >
                  {msg.text}
                </div>
              ) : null}

              <div className={cn("flex items-center justify-end gap-2 px-3 pb-2 text-[10px] text-muted-foreground")}
                data-testid={`meta-${msg.id}`}
              >
                {msg.starred ? <span data-testid={`star-${msg.id}`}>★</span> : null}
                <span>{format(msg.ts, "h:mm a")}</span>
                {mine ? <StatusTicks status={msg.status} /> : null}
              </div>
            </div>

            <div className={cn("mt-1 flex items-center gap-2", mine ? "justify-end" : "justify-start")}
              data-testid={`actions-${msg.id}`}
            >
              <ReactionPill emoji="👍" onClick={() => onReact("👍")} />
              <ReactionPill emoji="❤️" onClick={() => onReact("❤️")} />
              <ReactionPill emoji="😂" onClick={() => onReact("😂")} />
              <button
                onClick={onReply}
                className="rounded-full bg-white/70 px-2 py-1 text-[12px] font-semibold text-muted-foreground ring-1 ring-black/10"
                data-testid={`button-reply-${msg.id}`}
              >
                Reply
              </button>
              <button
                onClick={onToggleStar}
                className="rounded-full bg-white/70 px-2 py-1 text-[12px] font-semibold text-muted-foreground ring-1 ring-black/10"
                data-testid={`button-star-${msg.id}`}
              >
                {msg.starred ? "Unstar" : "Star"}
              </button>
              {mine ? (
                <button
                  onClick={onEdit}
                  className="rounded-full bg-white/70 px-2 py-1 text-[12px] font-semibold text-muted-foreground ring-1 ring-black/10"
                  data-testid={`button-edit-${msg.id}`}
                >
                  Edit
                </button>
              ) : null}
              <button
                onClick={onCopy}
                className="rounded-full bg-white/70 px-2 py-1 text-[12px] font-semibold text-muted-foreground ring-1 ring-black/10"
                data-testid={`button-copy-${msg.id}`}
              >
                Copy
              </button>
              <button
                onClick={onDelete}
                className="rounded-full bg-white/70 px-2 py-1 text-[12px] font-semibold text-red-500 ring-1 ring-black/10"
                data-testid={`button-delete-${msg.id}`}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({
  draft,
  setDraft,
  onSend,
  onAttach,
  onOpenEmoji,
  sendingDisabled,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSend: () => void;
  onAttach: () => void;
  onOpenEmoji: () => void;
  sendingDisabled: boolean;
}) {
  const canSend = draft.text.trim().length > 0 && !sendingDisabled;

  return (
    <div className="pointer-events-auto mx-auto w-full max-w-[420px] px-4 pb-4" data-testid="composer">
      {draft.replyTo ? (
        <div className="mb-2 rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-black/5" data-testid="composer-reply">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-muted-foreground">Replying</div>
              <div className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">{draft.replyTo.preview}</div>
            </div>
            <button
              onClick={() => setDraft({ ...draft, replyTo: undefined })}
              className="grid h-8 w-8 place-items-center rounded-full bg-black/5"
              data-testid="button-reply-cancel"
            >
              <ChevronDown className="h-4 w-4 rotate-180 text-muted-foreground" />
            </button>
          </div>
        </div>
      ) : null}

      {draft.editingId ? (
        <div className="mb-2 rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-black/5" data-testid="composer-editing">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-semibold text-muted-foreground">Editing message</div>
            <button
              onClick={() => setDraft({ ...draft, editingId: undefined })}
              className="rounded-full px-2 py-1 text-[12px] font-semibold text-muted-foreground"
              data-testid="button-edit-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <button
          onClick={onOpenEmoji}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-white/70 text-muted-foreground ring-1 ring-black/5"
          data-testid="button-emoji"
        >
          <Smile className="h-5 w-5" />
        </button>

        <div className="flex-1 rounded-2xl bg-white/70 ring-1 ring-black/5">
          <input
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            placeholder="Message"
            className="h-11 w-full bg-transparent px-3 text-[13px] outline-none"
            data-testid="input-message"
          />
        </div>

        <button
          onClick={onAttach}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-white/70 text-muted-foreground ring-1 ring-black/5"
          data-testid="button-attach"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <button
          onClick={canSend ? onSend : onAttach}
          className="grid h-11 w-11 place-items-center rounded-2xl text-white shadow-[0_16px_45px_hsl(var(--primary)/0.32)]"
          style={pillGradientStyle()}
          data-testid="button-send"
        >
          {canSend ? <Send className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

function EmojiStrip({ onPick }: { onPick: (e: string) => void }) {
  const emojis = ["😀", "😅", "😂", "😍", "🥳", "👍", "❤️", "🙏"];
  return (
    <div className="mx-auto w-full max-w-[420px] px-4 pb-2" data-testid="emoji-strip">
      <div className="flex items-center justify-between rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-black/5">
        {emojis.map((e) => (
          <button
            key={e}
            onClick={() => onPick(e)}
            className="grid h-9 w-9 place-items-center rounded-xl bg-black/5"
            data-testid={`emoji-${e}`}
          >
            <span className="text-[16px]">{e}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatHeader({
  chat,
  onBack,
  onSearch,
  onCall,
  onVideo,
  onMore,
  unread,
}: {
  chat: Chat;
  onBack: () => void;
  onSearch: () => void;
  onCall: () => void;
  onVideo: () => void;
  onMore: () => void;
  unread: number;
}) {
  return (
    <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[420px] px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 ring-1 ring-black/5"
              data-testid="button-chat-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              onClick={onMore}
              className="flex items-center gap-2 rounded-full bg-white/60 px-2 py-1 ring-1 ring-black/5"
              data-testid="button-chat-header"
            >
              <img src={chat.avatar} alt="" className="h-9 w-9 rounded-full object-cover" data-testid="img-chat-avatar" />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold" data-testid="text-chat-name">
                  {chat.title}
                </div>
                <div className="truncate text-[11px] text-muted-foreground" data-testid="text-chat-status">
                  {unread > 0 ? `${unread} unread` : "Online • 8 members"}
                </div>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSearch}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-muted-foreground ring-1 ring-black/5"
              data-testid="button-chat-search"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              onClick={onCall}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-muted-foreground ring-1 ring-black/5"
              data-testid="button-chat-call"
            >
              <Phone className="h-5 w-5" />
            </button>
            <button
              onClick={onVideo}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-muted-foreground ring-1 ring-black/5"
              data-testid="button-chat-video"
            >
              <Video className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoSheet({ chat, onClose }: { chat: Chat; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40">
      <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-end">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="relative rounded-t-[28px] bg-background px-5 pb-6 pt-4 shadow-[0_-20px_60px_rgba(0,0,0,0.18)]"
          data-testid="sheet-chat-info"
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/10" />
          <button
            onClick={onClose}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 ring-1 ring-black/5"
            data-testid="button-info-close"
          >
            <ChevronDown className="h-5 w-5 rotate-180" />
          </button>

          <div className="flex items-center gap-3">
            <img src={chat.avatar} alt="" className="h-14 w-14 rounded-2xl object-cover" data-testid="img-info-avatar" />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold" data-testid="text-info-title">
                {chat.title}
              </div>
              <div className="mt-0.5 truncate text-[12px] text-muted-foreground" data-testid="text-info-subtitle">
                {chat.subtitle}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <button
              className="flex w-full items-center justify-between rounded-2xl bg-white/60 px-4 py-4 ring-1 ring-black/5"
              data-testid="button-info-mute"
            >
              <div className="text-[13px] font-semibold">Mute notifications</div>
              <div className="h-6 w-10 rounded-full bg-black/10" aria-hidden />
            </button>
            <button
              className="flex w-full items-center justify-between rounded-2xl bg-white/60 px-4 py-4 ring-1 ring-black/5"
              data-testid="button-info-wallpaper"
            >
              <div className="text-[13px] font-semibold">Wallpaper</div>
              <div className="text-[12px] text-muted-foreground">Default</div>
            </button>
            <button
              className="flex w-full items-center justify-between rounded-2xl bg-white/60 px-4 py-4 ring-1 ring-black/5"
              data-testid="button-info-media"
            >
              <div className="text-[13px] font-semibold">Media, links, docs</div>
              <div className="text-[12px] text-muted-foreground">12</div>
            </button>
            <button
              className="flex w-full items-center justify-between rounded-2xl bg-white/60 px-4 py-4 ring-1 ring-black/5"
              data-testid="button-info-search"
            >
              <div className="text-[13px] font-semibold">Search in chat</div>
              <div className="text-[12px] text-muted-foreground">⌘ F</div>
            </button>
            <button
              className="flex w-full items-center justify-between rounded-2xl bg-white/60 px-4 py-4 ring-1 ring-black/5"
              data-testid="button-info-report"
            >
              <div className="text-[13px] font-semibold text-red-500">Report</div>
              <div className="text-[12px] text-muted-foreground">\u2026</div>
            </button>
          </div>

          <div className="mt-5">
            <Button
              className="h-12 w-full rounded-full text-[14px] font-semibold"
              style={pillGradientStyle()}
              data-testid="button-info-close-primary"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function Messages() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"list" | "chat">("list");
  const [activeChatId, setActiveChatId] = useState<ChatId | null>(null);
  const [search, setSearch] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const joinedBubbleIds = useMemo(() => {
    const keys = Object.keys(window.localStorage).filter((k) => k.startsWith(LS_JOINED_PREFIX));
    return keys
      .filter((k) => window.localStorage.getItem(k) === "1")
      .map((k) => k.replace(LS_JOINED_PREFIX, ""));
  }, []);

  const seedChats: Chat[] = useMemo(
    () => [
      { id: "chat-sf-pickleball", bubbleId: "sf-pickleball", title: "SF Pickleball Crew", subtitle: "8 online • 20 members", avatar: avatar2 },
      { id: "chat-bark-dogpatch", bubbleId: "bark-dogpatch", title: "Bark at Dogpatch", subtitle: "Pups welcome • 112 members", avatar: avatar1 },
      { id: "chat-park-picnic", bubbleId: "park-picnic", title: "Park Picnic & Cards", subtitle: "Next: Sunday picnic", avatar: avatar3 },
      { id: "chat-food-finds", bubbleId: "food-finds", title: "Food Finds", subtitle: "Drop your recs", avatar: avatar2 },
      { id: "chat-marina-meetup", bubbleId: "marina-meetup", title: "Marina Meetup", subtitle: "Sunset walk today", avatar: avatar1 },
      { id: "chat-mindful-mamas", bubbleId: "mindful-mamas", title: "Mindful Mamas", subtitle: "Gentle reminder: breathe", avatar: avatar3 },
    ],
    [],
  );

  const chats = useMemo(() => {
    const persisted = loadJson<Chat[]>(LS_CHATS, []);
    const merged = persisted.length ? persisted : seedChats;
    const filteredToJoined = merged.filter((c) => joinedBubbleIds.includes(c.bubbleId));
    const pinned = filteredToJoined.filter((c) => c.pinned);
    const rest = filteredToJoined.filter((c) => !c.pinned);
    return [...pinned, ...rest];
  }, [joinedBubbleIds, seedChats]);

  const [unreadByChat, setUnreadByChat] = useState<Record<string, number>>(() => loadJson(LS_UNREAD, {}));

  const unreadTotal = useMemo(() => Object.values(unreadByChat).reduce((a, b) => a + (b || 0), 0), [unreadByChat]);

  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>(() => {
    const saved = loadJson<Record<string, Message[]>>(LS_MESSAGES, {});
    if (Object.keys(saved).length) return saved;

    const base: Record<string, Message[]> = {};
    for (const c of seedChats) {
      base[c.id] = [
        {
          id: nowId(),
          chatId: c.id,
          from: "other",
          authorName: "Host",
          type: "system",
          text: `Welcome to ${c.title}. Be kind, keep it local.`,
          ts: Date.now() - 1000 * 60 * 60 * 22,
        },
        {
          id: nowId(),
          chatId: c.id,
          from: "other",
          authorName: "Alexa",
          type: "text",
          text: "Anyone down for a quick meetup this week?",
          ts: Date.now() - 1000 * 60 * 90,
        },
        {
          id: nowId(),
          chatId: c.id,
          from: "me",
          type: "text",
          text: "I can do Thursday after work.",
          ts: Date.now() - 1000 * 60 * 82,
          status: "read",
        },
        {
          id: nowId(),
          chatId: c.id,
          from: "other",
          authorName: "Brandon",
          type: "text",
          text: "Perfect. Let’s pick a spot near the park.",
          ts: Date.now() - 1000 * 60 * 80,
        },
        {
          id: nowId(),
          chatId: c.id,
          from: "me",
          type: "text",
          text: "I’ll bring extra paddles/snacks.",
          ts: Date.now() - 1000 * 60 * 78,
          status: "delivered",
        },
      ];
    }
    return base;
  });

  useEffect(() => {
    saveJson(LS_UNREAD, unreadByChat);
  }, [unreadByChat]);

  useEffect(() => {
    saveJson(LS_MESSAGES, messagesByChat);
  }, [messagesByChat]);

  useEffect(() => {
    saveJson(LS_CHATS, chats);
  }, [chats]);

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) ?? null, [chats, activeChatId]);

  const activeMessages = useMemo(() => {
    if (!activeChatId) return [];
    return messagesByChat[activeChatId] ?? [];
  }, [messagesByChat, activeChatId]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    if (view === "chat") {
      window.setTimeout(scrollToBottom, 0);
    }
  }, [view, activeChatId]);

  const [draft, setDraft] = useState<Draft>({ text: "" });

  const openChat = (id: ChatId) => {
    setActiveChatId(id);
    setView("chat");
    setShowEmoji(false);
    setDraft({ text: "" });
    setUnreadByChat((p) => ({ ...p, [id]: 0 }));
  };

  const showToast = (text: string) => {
    setToastText(text);
    window.setTimeout(() => setToastText(null), 1400);
  };

  const send = () => {
    if (!activeChatId) return;
    const text = draft.text.trim();
    if (!text) return;

    const list = messagesByChat[activeChatId] ?? [];

    if (draft.editingId) {
      const next = list.map((m) => (m.id === draft.editingId ? { ...m, text } : m));
      setMessagesByChat((p) => ({ ...p, [activeChatId]: next }));
      setDraft({ text: "" });
      showToast("Edited");
      window.setTimeout(scrollToBottom, 0);
      return;
    }

    const msg: Message = {
      id: nowId(),
      chatId: activeChatId,
      from: "me",
      type: "text",
      text,
      ts: Date.now(),
      status: "sending",
      replyTo: draft.replyTo,
    };

    setMessagesByChat((p) => ({ ...p, [activeChatId]: [...list, msg] }));
    setDraft({ text: "" });
    softHaptic();
    window.setTimeout(scrollToBottom, 0);

    // simulate delivery progression
    window.setTimeout(() => {
      setMessagesByChat((p) => {
        const arr = p[activeChatId] ?? [];
        return {
          ...p,
          [activeChatId]: arr.map((m) => (m.id === msg.id ? { ...m, status: "sent" } : m)),
        };
      });
    }, 300);
    window.setTimeout(() => {
      setMessagesByChat((p) => {
        const arr = p[activeChatId] ?? [];
        return {
          ...p,
          [activeChatId]: arr.map((m) => (m.id === msg.id ? { ...m, status: "delivered" } : m)),
        };
      });
    }, 900);
    window.setTimeout(() => {
      setMessagesByChat((p) => {
        const arr = p[activeChatId] ?? [];
        return {
          ...p,
          [activeChatId]: arr.map((m) => (m.id === msg.id ? { ...m, status: "read" } : m)),
        };
      });
    }, 1500);
  };

  const attach = () => {
    if (!activeChatId) return;
    const list = messagesByChat[activeChatId] ?? [];
    const msg: Message = {
      id: nowId(),
      chatId: activeChatId,
      from: "me",
      type: "image",
      imageUrl: avatar1,
      ts: Date.now(),
      status: "sending",
    };
    setMessagesByChat((p) => ({ ...p, [activeChatId]: [...list, msg] }));
    showToast("Photo attached");
    window.setTimeout(scrollToBottom, 0);
  };

  const reactTo = (msgId: string, emoji: string) => {
    // UI-only: we show toast to indicate reaction
    showToast(`Reacted ${emoji}`);
  };

  const copyText = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied");
    } catch {
      showToast("Copy failed");
    }
  };

  const del = (msgId: string) => {
    if (!activeChatId) return;
    setMessagesByChat((p) => {
      const arr = p[activeChatId] ?? [];
      return { ...p, [activeChatId]: arr.filter((m) => m.id !== msgId) };
    });
    showToast("Deleted");
  };

  const star = (msgId: string) => {
    if (!activeChatId) return;
    setMessagesByChat((p) => {
      const arr = p[activeChatId] ?? [];
      return {
        ...p,
        [activeChatId]: arr.map((m) => (m.id === msgId ? { ...m, starred: !m.starred } : m)),
      };
    });
  };

  const reply = (msg: Message) => {
    const preview = msg.text ? msg.text : msg.type === "image" ? "Photo" : "Message";
    setDraft((d) => ({ ...d, replyTo: { id: msg.id, preview, from: msg.from } }));
    showToast("Reply");
  };

  const editMsg = (msg: Message) => {
    if (msg.from !== "me" || !msg.text) return;
    setDraft({ text: msg.text, editingId: msg.id });
    showToast("Edit");
  };

  const listFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
  }, [chats, search]);

  if (view === "chat" && activeChat) {
    const unread = unreadByChat[activeChat.id] || 0;

    return (
      <div className="min-h-dvh bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(900px circle at 20% 10%, hsl(var(--primary) / .10), transparent 52%), radial-gradient(900px circle at 90% 25%, hsl(var(--brand-2) / .10), transparent 55%), radial-gradient(900px circle at 50% 90%, hsl(var(--brand-3) / .08), transparent 55%)",
            }}
          />
          <div className="absolute inset-0 bg-grid opacity-40" />
        </div>

        <ChatHeader
          chat={activeChat}
          unread={unread}
          onBack={() => setView("list")}
          onSearch={() => showToast("Search")}
          onCall={() => showToast("Voice call")}
          onVideo={() => showToast("Video call")}
          onMore={() => setShowInfo(true)}
        />

        <div
          ref={scrollerRef}
          className="mx-auto h-[calc(100dvh-168px)] w-full max-w-[420px] overflow-auto px-4 pb-4"
          data-testid="chat-scroll"
        >
          <div className="space-y-4 py-2">
            {activeMessages.map((m, idx) => {
              const prev = activeMessages[idx - 1];
              const showName = m.from === "other" && (!prev || prev.from !== "other" || prev.authorName !== m.authorName);
              return (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  showName={showName}
                  onReply={() => reply(m)}
                  onToggleStar={() => star(m.id)}
                  onCopy={() => copyText(m.text)}
                  onDelete={() => del(m.id)}
                  onEdit={() => editMsg(m)}
                  onReact={(e) => reactTo(m.id, e)}
                />
              );
            })}
          </div>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
          <div className="pointer-events-auto">
            {showEmoji ? (
              <EmojiStrip
                onPick={(e) => {
                  setDraft((d) => ({ ...d, text: `${d.text}${e}` }));
                  setShowEmoji(false);
                }}
              />
            ) : null}

            <Composer
              draft={draft}
              setDraft={setDraft}
              onSend={send}
              onAttach={attach}
              onOpenEmoji={() => setShowEmoji((v) => !v)}
              sendingDisabled={false}
            />
          </div>
        </div>

        {toastText ? (
          <div className="fixed left-1/2 top-20 z-40 -translate-x-1/2" data-testid="toast">
            <div className="rounded-full bg-black/70 px-4 py-2 text-[12px] font-semibold text-white">
              {toastText}
            </div>
          </div>
        ) : null}

        <AnimatePresence>{showInfo ? <InfoSheet chat={activeChat} onClose={() => setShowInfo(false)} /> : null}</AnimatePresence>
      </div>
    );
  }

  const hasChats = chats.length > 0;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px circle at 20% 10%, hsl(var(--primary) / .10), transparent 52%), radial-gradient(900px circle at 90% 25%, hsl(var(--brand-2) / .10), transparent 55%), radial-gradient(900px circle at 50% 90%, hsl(var(--brand-3) / .08), transparent 55%)",
          }}
        />
        <div className="absolute inset-0 bg-grid opacity-40" />
      </div>

      <TopBar
        title="Messages"
        onBack={() => navigate("/explore")}
        right={
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-muted-foreground ring-1 ring-black/5"
            data-testid="button-messages-more"
            onClick={() => setToastText("Settings")}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        }
      />

      <div className="mx-auto w-full max-w-[420px] px-5 pb-28 pt-2">
        <div className="rounded-2xl bg-white/60 px-3 py-2 ring-1 ring-black/5" data-testid="search-wrapper">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="h-9 w-full bg-transparent text-[13px] outline-none"
              data-testid="input-search"
            />
          </div>
        </div>

        {!hasChats ? <EmptyState onExplore={() => navigate("/explore")} /> : null}

        {hasChats ? (
          <div className="mt-4 space-y-3" data-testid="list-chats">
            {listFiltered.map((c) => (
              <ChatRow key={c.id} chat={c} unread={unreadByChat[c.id] || 0} onOpen={() => openChat(c.id)} />
            ))}
          </div>
        ) : null}
      </div>

      <BottomNav
        active="messages"
        unreadTotal={unreadTotal}
        onSelect={(id) => {
          if (id === "explore") return navigate("/explore");
          if (id === "messages") return;
          if (id === "bubbles") return navigate("/my-bubbles");
          setToastText(`${id} coming soon`);
          window.setTimeout(() => setToastText(null), 1200);
        }}
      />

      {toastText ? (
        <div className="fixed left-1/2 top-20 z-40 -translate-x-1/2" data-testid="toast">
          <div className="rounded-full bg-black/70 px-4 py-2 text-[12px] font-semibold text-white">
            {toastText}
          </div>
        </div>
      ) : null}
    </div>
  );
}
