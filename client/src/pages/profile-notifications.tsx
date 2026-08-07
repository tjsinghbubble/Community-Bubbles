import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

function Toggle({
  label,
  sublabel,
  value,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{label}</div>
        {sublabel && <div className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</div>}
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        data-testid={testId}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${value ? "bg-[hsl(var(--primary))]" : "bg-black/15"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

const DEFAULT_PREFS = {
  pushPaused: false,
  bubbleActivity: true,
  eventActivity: true,
  eventReminders: true,
  taskReminders: true,
  waitlistUpdates: true,
  announcements: true,
};

type Prefs = typeof DEFAULT_PREFS;

export default function ProfileNotifications() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  const { data, isLoading } = useQuery<Prefs>({
    queryKey: ["/api/notification-preferences"],
    queryFn: () => apiRequest("GET", "/api/notification-preferences").then((r) => r.json()),
    enabled: !!user,
  });

  useEffect(() => {
    if (data) setPrefs({ ...DEFAULT_PREFS, ...data });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (updates: Partial<Prefs>) => apiRequest("PUT", "/api/notification-preferences", updates),
    onSuccess: (_res, updates) => {
      qc.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
    },
    onError: (err: any, _updates, context) => {
      toast({ variant: "destructive", title: "Couldn't save", description: err.message || "Please try again." });
      if (data) setPrefs({ ...DEFAULT_PREFS, ...data });
    },
  });

  const update = (key: keyof Prefs, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    saveMutation.mutate({ [key]: value });
  };

  const disabled = isLoading || !user;

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
            <div className="divide-y divide-black/5">
              <Toggle
                label="Pause all push notifications"
                sublabel="Turn off every notification below at once"
                value={prefs.pushPaused}
                onChange={(v) => update("pushPaused", v)}
                disabled={disabled}
                testId="toggle-push-paused"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white/60 ring-1 ring-black/5">
            <div className="border-b border-black/5 px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Activity
              </span>
            </div>
            <div className="divide-y divide-black/5">
              <Toggle label="Bubble activity" sublabel="New members, posts, and updates" value={prefs.bubbleActivity} onChange={(v) => update("bubbleActivity", v)} disabled={disabled || prefs.pushPaused} testId="toggle-bubble-activity" />
              <Toggle label="Event activity" sublabel="New events and changes in your bubbles" value={prefs.eventActivity} onChange={(v) => update("eventActivity", v)} disabled={disabled || prefs.pushPaused} testId="toggle-event-activity" />
              <Toggle label="Event reminders" sublabel="Before events you've RSVP'd to" value={prefs.eventReminders} onChange={(v) => update("eventReminders", v)} disabled={disabled || prefs.pushPaused} testId="toggle-event-reminders" />
              <Toggle label="Task reminders" sublabel="Volunteer sign-up tasks you've joined" value={prefs.taskReminders} onChange={(v) => update("taskReminders", v)} disabled={disabled || prefs.pushPaused} testId="toggle-task-reminders" />
              <Toggle label="Waitlist updates" sublabel="When your status on a waitlist changes" value={prefs.waitlistUpdates} onChange={(v) => update("waitlistUpdates", v)} disabled={disabled || prefs.pushPaused} testId="toggle-waitlist-updates" />
              <Toggle label="Announcements & messages" sublabel="Admin announcements and new messages" value={prefs.announcements} onChange={(v) => update("announcements", v)} disabled={disabled || prefs.pushPaused} testId="toggle-announcements" />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
