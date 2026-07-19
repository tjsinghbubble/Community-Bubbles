import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

function RadioRow({
  label,
  sublabel,
  selected,
  onClick,
  testId,
}: {
  label: string;
  sublabel?: string;
  selected: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-black/5"
    >
      <div
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
          selected
            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]"
            : "border-black/20 bg-transparent"
        }`}
      >
        {selected && <div className="h-2 w-2 rounded-full bg-white" />}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{label}</div>
        {sublabel && <div className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</div>}
      </div>
    </button>
  );
}

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

type PrivacySettings = {
  profileVisibility: "public" | "members" | "private";
  showInterests: boolean;
  showBubbles: boolean;
};

const DEFAULT_SETTINGS: PrivacySettings = {
  profileVisibility: "public",
  showInterests: true,
  showBubbles: true,
};

export default function ProfilePrivacy() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);

  const { data, isLoading } = useQuery<PrivacySettings>({
    queryKey: ["/api/privacy-settings"],
    queryFn: () => apiRequest("GET", "/api/privacy-settings").then((r) => r.json()),
    enabled: !!user,
  });

  useEffect(() => {
    if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (updates: Partial<PrivacySettings>) => apiRequest("PUT", "/api/privacy-settings", updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/privacy-settings"] }),
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Couldn't save", description: err.message || "Please try again." });
      if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
    },
  });

  const updateVisibility = (v: PrivacySettings["profileVisibility"]) => {
    setSettings((s) => ({ ...s, profileVisibility: v }));
    saveMutation.mutate({ profileVisibility: v });
  };
  const updateShowInterests = (v: boolean) => {
    setSettings((s) => ({ ...s, showInterests: v }));
    saveMutation.mutate({ showInterests: v });
  };
  const updateShowBubbles = (v: boolean) => {
    setSettings((s) => ({ ...s, showBubbles: v }));
    saveMutation.mutate({ showBubbles: v });
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
          <h1 className="font-display text-[20px] font-bold tracking-tight">Privacy</h1>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl bg-white/60 ring-1 ring-black/5">
            <div className="border-b border-black/5 px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Profile Visibility
              </span>
            </div>
            <div className="divide-y divide-black/5">
              <RadioRow
                label="Public"
                sublabel="Anyone can view your profile"
                selected={settings.profileVisibility === "public"}
                onClick={() => !disabled && updateVisibility("public")}
                testId="radio-public"
              />
              <RadioRow
                label="Bubble Members Only"
                sublabel="Only people in your bubbles can see you"
                selected={settings.profileVisibility === "members"}
                onClick={() => !disabled && updateVisibility("members")}
                testId="radio-members"
              />
              <RadioRow
                label="Private"
                sublabel="Only you can see your full profile"
                selected={settings.profileVisibility === "private"}
                onClick={() => !disabled && updateVisibility("private")}
                testId="radio-private"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white/60 ring-1 ring-black/5">
            <div className="border-b border-black/5 px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                What Others Can See
              </span>
            </div>
            <div className="divide-y divide-black/5">
              <Toggle
                label="Interests"
                sublabel="Show your interest tags on your profile"
                value={settings.showInterests}
                onChange={updateShowInterests}
                testId="toggle-show-interests"
              />
              <Toggle
                label="My Bubbles"
                sublabel="Show which communities you belong to"
                value={settings.showBubbles}
                onChange={updateShowBubbles}
                testId="toggle-show-bubbles"
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
