import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";

function Toggle({
  label,
  sublabel,
  value,
  onChange,
  testId,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{label}</div>
        {sublabel && <div className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        data-testid={testId}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-[hsl(var(--primary))]" : "bg-black/15"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

function Divider() {
  return <div className="mx-5 border-t border-black/5" />;
}

export default function ProfileNotifications() {
  const [, navigate] = useLocation();
  const [pushAll, setPushAll] = useState(true);
  const [newMessages, setNewMessages] = useState(true);
  const [eventReminders, setEventReminders] = useState(true);
  const [newMembers, setNewMembers] = useState(false);
  const [emailDigest, setEmailDigest] = useState(false);
  const [marketing, setMarketing] = useState(false);

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 md:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 ring-1 ring-black/5 text-foreground/70 shadow-sm"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-[20px] font-bold tracking-tight">Notifications</h1>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl bg-white/60 ring-1 ring-black/5">
            <div className="border-b border-black/5 px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Push Notifications
              </span>
            </div>
            <div className="divide-y divide-black/5">
              <Toggle label="Enable push notifications" value={pushAll} onChange={setPushAll} testId="toggle-push-all" />
              <Toggle label="New messages" sublabel="Group chats and DMs" value={newMessages} onChange={setNewMessages} testId="toggle-new-messages" />
              <Toggle label="Event reminders" sublabel="24 hours and 1 hour before" value={eventReminders} onChange={setEventReminders} testId="toggle-event-reminders" />
              <Toggle label="New members" sublabel="When someone joins your bubble" value={newMembers} onChange={setNewMembers} testId="toggle-new-members" />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white/60 ring-1 ring-black/5">
            <div className="border-b border-black/5 px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Email
              </span>
            </div>
            <div className="divide-y divide-black/5">
              <Toggle label="Weekly digest" sublabel="Summary of activity in your bubbles" value={emailDigest} onChange={setEmailDigest} testId="toggle-email-digest" />
              <Toggle label="News and updates" sublabel="Product announcements" value={marketing} onChange={setMarketing} testId="toggle-marketing" />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
