import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CheckCheck,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  Users,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { webCometChat } from "@/lib/cometchat";


type ChatId = string;

type Chat = {
  id: ChatId;
  bubbleId: string;
  title: string;
  subtitle: string;
  avatar: string;
  lastMessageText?: string;
  lastMessageTs?: number;
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

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function softHaptic() {}

function pillGradientStyle() {
  return { background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" };
}

function mapCcMessage(m: any, myUid: string): Message {
  const isMe = m.getSender?.()?.getUid?.() === myUid;
  const msgType = m.getType?.();
  const isText = msgType === "text";
  return {
    id: String(m.getId?.() ?? nowId()),
    chatId: m.getReceiverId?.() ?? "",
    from: isMe ? "me" : "other",
    authorName: m.getSender?.()?.getName?.() || "Unknown",
    type: isText ? "text" : "image",
    text: isText ? m.getText?.() : undefined,
    imageUrl: !isText ? m.getURL?.() : undefined,
    ts: (m.getSentAt?.() ?? 0) * 1000,
    status: "read",
  };
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
  const timeStr = chat.lastMessageTs
    ? format(chat.lastMessageTs, "h:mm a")
    : "";

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl bg-white/50 px-3 py-3 ring-1 ring-black/5"
      data-testid={`row-chat-${chat.id}`}
    >
      {chat.avatar ? (
        <img
          src={chat.avatar}
          alt=""
          className="h-12 w-12 shrink-0 rounded-2xl object-cover"
          data-testid={`img-chat-${chat.id}`}
        />
      ) : (
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
        >
          <Users className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-[13px] font-semibold" data-testid={`text-chat-title-${chat.id}`}>
            {chat.title}
          </div>
          <UnreadBadge count={unread} />
        </div>
        <div className="mt-0.5 truncate text-[12px] text-muted-foreground" data-testid={`text-chat-subtitle-${chat.id}`}>
          {chat.lastMessageText || chat.subtitle}
        </div>
      </div>
      {timeStr ? (
        <div className="text-[11px] text-muted-foreground" data-testid={`text-chat-time-${chat.id}`}>
          {timeStr}
        </div>
      ) : null}
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
          <div className={cn("relative")}>
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
                <span>{msg.ts > 0 ? format(msg.ts, "h:mm a") : ""}</span>
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
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
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
          onClick={onSend}
          disabled={!canSend}
          className={cn(
            "grid h-11 w-11 place-items-center rounded-2xl text-white transition-opacity",
            canSend ? "opacity-100" : "opacity-40",
          )}
          style={pillGradientStyle()}
          data-testid="button-send"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

const EMOJI_STRIP = ["😀", "😂", "🥰", "😎", "🤔", "😅", "🙏", "🔥", "❤️", "👍", "👋", "🎉"];

function EmojiStrip({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div className="pointer-events-auto mx-auto w-full max-w-[420px] px-4 pb-1">
      <div className="flex gap-2 overflow-x-auto rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-black/5" data-testid="emoji-strip">
        {EMOJI_STRIP.map((e) => (
          <button
            key={e}
            onClick={() => onPick(e)}
            className="shrink-0 text-[22px]"
            data-testid={`emoji-${e}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatHeader({
  chat,
  unread,
  onBack,
  onSearch,
  onCall,
  onVideo,
  onMore,
}: {
  chat: Chat;
  unread: number;
  onBack: () => void;
  onSearch: () => void;
  onCall: () => void;
  onVideo: () => void;
  onMore: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[420px] items-center gap-3 px-4 py-3">
        <button
          onClick={onBack}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5"
          data-testid="button-chat-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {chat.avatar ? (
          <img src={chat.avatar} alt="" className="h-10 w-10 shrink-0 rounded-2xl object-cover" data-testid="img-chat-header" />
        ) : (
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
          >
            <Users className="h-4 w-4" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold" data-testid="text-chat-header-title">{chat.title}</div>
          <div className="truncate text-[11px] text-muted-foreground" data-testid="text-chat-header-subtitle">
            {chat.subtitle}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unread > 0 ? <UnreadBadge count={unread} /> : null}
          <button onClick={onCall} className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-muted-foreground ring-1 ring-black/5" data-testid="button-call">
            <Phone className="h-4 w-4" />
          </button>
          <button onClick={onVideo} className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-muted-foreground ring-1 ring-black/5" data-testid="button-video">
            <Video className="h-4 w-4" />
          </button>
          <button onClick={onMore} className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-muted-foreground ring-1 ring-black/5" data-testid="button-chat-more">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoSheet({ chat, onClose }: { chat: Chat; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" data-testid="info-sheet">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative z-10 w-full max-w-[420px] rounded-t-[28px] bg-background px-5 pb-10 pt-4"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/20" />
        <div className="text-[16px] font-semibold" data-testid="text-info-title">{chat.title}</div>
        <div className="mt-1 text-[13px] text-muted-foreground" data-testid="text-info-subtitle">{chat.subtitle}</div>

        <div className="mt-5 space-y-3">
          {(["Mute notifications", "Search in chat", "View members", "Leave group"] as const).map((item) => (
            <button
              key={item}
              onClick={onClose}
              className="flex w-full items-center rounded-2xl bg-white/60 px-4 py-3 text-left text-[13px] font-medium ring-1 ring-black/5"
              data-testid={`action-${item.toLowerCase().replace(/ /g, "-")}`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full rounded-2xl"
            data-testid="button-info-done"
          >
            Done
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Messages() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [view, setView] = useState<"list" | "chat">("list");
  const [activeChatId, setActiveChatId] = useState<ChatId | null>(null);
  const [search, setSearch] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ text: "" });

  const [ccReady, setCcReady] = useState(false);
  const [ccError, setCcError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Chat[]>([]);
  const [unreadByChat, setUnreadByChat] = useState<Record<string, number>>({});
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const listenerIdRef = useRef<string | null>(null);
  const myUidRef = useRef<string>("");

  const { data: myBubbles } = useQuery<any[]>({
    queryKey: ["/api/bubbles/my"],
    queryFn: () => apiRequest("GET", "/api/bubbles/my").then((r) => r.json()),
    enabled: !!user,
  });

  const bubbleImageMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!myBubbles) return map;
    for (const b of myBubbles) {
      const img = b.coverImage || b.images?.[0] || "";
      if (img) map[b.id] = img;
    }
    return map;
  }, [myBubbles]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        await webCometChat.init();
        const existing = await webCometChat.getLoggedInUser();
        if (!existing) {
          const { authToken } = await apiRequest("POST", "/api/cometchat/auth-token").then((r) => r.json());
          await webCometChat.loginWithToken(authToken);
        }
        const me = await webCometChat.getLoggedInUser();
        myUidRef.current = me?.getUid() ?? user.id;

        if (!cancelled) {
          setCcReady(true);
          await loadConversations();
        }
      } catch (err: any) {
        if (!cancelled) setCcError(err?.message || "Could not connect to chat");
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const loadConversations = async () => {
    try {
      const convs = await webCometChat.getConversations();
      const mapped: Chat[] = convs.map((c: any) => {
        const group = c.getConversationWith();
        const guid: string = group?.getGuid?.() ?? "";
        const lastMsg = c.getLastMessage();
        const lastText: string | undefined = lastMsg?.getText?.();
        const lastTs: number | undefined = lastMsg?.getSentAt?.()
          ? lastMsg.getSentAt() * 1000
          : undefined;

        return {
          id: guid,
          bubbleId: guid,
          title: group?.getName?.() ?? "Group",
          subtitle: `${group?.getMembersCount?.() ?? 0} members`,
          avatar: bubbleImageMap[guid] ?? group?.getIcon?.() ?? "",
          lastMessageText: lastText,
          lastMessageTs: lastTs,
        };
      });

      const unread: Record<string, number> = {};
      convs.forEach((c: any) => {
        const guid = c.getConversationWith()?.getGuid?.() ?? "";
        unread[guid] = c.getUnreadMessageCount?.() ?? 0;
      });

      setConversations(mapped);
      setUnreadByChat(unread);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  useEffect(() => {
    if (!bubbleImageMap || !conversations.length) return;
    setConversations((prev) =>
      prev.map((c) => ({
        ...c,
        avatar: bubbleImageMap[c.bubbleId] || c.avatar,
      }))
    );
  }, [bubbleImageMap]);

  useEffect(() => {
    if (!activeChatId) return;
    const listenerId = `web-msg-${activeChatId}-${Date.now()}`;
    listenerIdRef.current = listenerId;

    webCometChat.addMessageListener(
      listenerId,
      new CometChat.MessageListener({
        onTextMessageReceived: (msg: any) => {
          if (msg.getReceiverId?.() === activeChatId) {
            const mapped = mapCcMessage(msg, myUidRef.current);
            setActiveMessages((prev) => [...prev, mapped]);
            scrollToBottom();
          }
        },
      }),
    );

    return () => {
      webCometChat.removeMessageListener(listenerId);
      listenerIdRef.current = null;
    };
  }, [activeChatId]);

  const scrollToBottom = () => {
    window.setTimeout(() => {
      if (scrollerRef.current) {
        scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
      }
    }, 0);
  };

  useEffect(() => {
    if (view === "chat") scrollToBottom();
  }, [view, activeChatId]);

  const openChat = async (chatId: ChatId) => {
    setActiveChatId(chatId);
    setView("chat");
    setShowEmoji(false);
    setDraft({ text: "" });
    setActiveMessages([]);
    setLoadingMessages(true);
    setUnreadByChat((p) => ({ ...p, [chatId]: 0 }));

    try {
      const msgs = await webCometChat.getMessages(chatId);
      const mapped = msgs.map((m: any) => mapCcMessage(m, myUidRef.current));
      setActiveMessages(mapped);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoadingMessages(false);
      scrollToBottom();
    }
  };

  const showToast = (text: string) => {
    setToastText(text);
    window.setTimeout(() => setToastText(null), 1400);
  };

  const send = async () => {
    if (!activeChatId || sending) return;
    const text = draft.text.trim();
    if (!text) return;

    const optimisticId = nowId();
    const optimistic: Message = {
      id: optimisticId,
      chatId: activeChatId,
      from: "me",
      type: "text",
      text,
      ts: Date.now(),
      status: "sending",
      replyTo: draft.replyTo,
    };

    setActiveMessages((prev) => [...prev, optimistic]);
    setDraft({ text: "" });
    scrollToBottom();
    setSending(true);

    try {
      const sent = await webCometChat.sendMessage(activeChatId, text);
      const sentMapped = mapCcMessage(sent, myUidRef.current);
      sentMapped.status = "sent";
      setActiveMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? sentMapped : m)),
      );

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? { ...c, lastMessageText: text, lastMessageTs: Date.now() }
            : c,
        ),
      );
    } catch (err) {
      console.error("Send failed:", err);
      showToast("Failed to send");
      setActiveMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setSending(false);
    }
  };

  const attach = () => showToast("Photo upload coming soon");

  const reactTo = (_msgId: string, emoji: string) => showToast(`Reacted ${emoji}`);

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
    setActiveMessages((prev) => prev.filter((m) => m.id !== msgId));
    showToast("Deleted locally");
  };

  const star = (msgId: string) => {
    setActiveMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, starred: !m.starred } : m)),
    );
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

  const unreadTotal = useMemo(
    () => Object.values(unreadByChat).reduce((a, b) => a + (b || 0), 0),
    [unreadByChat],
  );

  const listFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, search]);

  const activeChat = useMemo(
    () => conversations.find((c) => c.id === activeChatId) ?? null,
    [conversations, activeChatId],
  );

  const bgLayer = (
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
  );

  if (view === "chat" && activeChat) {
    const unread = unreadByChat[activeChat.id] || 0;

    return (
      <div className="min-h-dvh bg-background text-foreground">
        {bgLayer}

        <ChatHeader
          chat={activeChat}
          unread={unread}
          onBack={() => { setView("list"); setActiveChatId(null); setActiveMessages([]); }}
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
          {loadingMessages ? (
            <div className="flex justify-center py-10 text-[13px] text-muted-foreground" data-testid="loading-messages">
              Loading messages…
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="flex justify-center py-10 text-[13px] text-muted-foreground" data-testid="empty-messages">
              No messages yet. Say hello!
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {activeMessages.map((m, idx) => {
                const prev = activeMessages[idx - 1];
                const showName =
                  m.from === "other" &&
                  (!prev || prev.from !== "other" || prev.authorName !== m.authorName);
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
          )}
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
              sendingDisabled={sending || !ccReady}
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

        <AnimatePresence>
          {showInfo ? <InfoSheet chat={activeChat} onClose={() => setShowInfo(false)} /> : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {bgLayer}

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

        {ccError ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-[13px] text-red-600 ring-1 ring-red-100" data-testid="error-cc">
            {ccError}
          </div>
        ) : null}

        {!ccReady && !ccError ? (
          <div className="mt-10 flex justify-center text-[13px] text-muted-foreground" data-testid="loading-cc">
            Connecting to chat…
          </div>
        ) : conversations.length === 0 && ccReady ? (
          <EmptyState onExplore={() => navigate("/explore")} />
        ) : null}

        {conversations.length > 0 ? (
          <div className="mt-4 space-y-3" data-testid="list-chats">
            {listFiltered.map((c) => (
              <ChatRow
                key={c.id}
                chat={c}
                unread={unreadByChat[c.id] || 0}
                onOpen={() => openChat(c.id)}
              />
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
          if (id === "upcoming") return navigate("/upcoming");
          if (id === "profile") return navigate("/profile");
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
