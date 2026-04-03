import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";

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

export default function ProfilePrivacy() {
  const [, navigate] = useLocation();
  const [profileVisibility, setProfileVisibility] = useState<"public" | "members" | "private">("public");
  const [showInterests, setShowInterests] = useState(true);
  const [showBubbles, setShowBubbles] = useState(true);

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
                selected={profileVisibility === "public"}
                onClick={() => setProfileVisibility("public")}
                testId="radio-public"
              />
              <RadioRow
                label="Bubble Members Only"
                sublabel="Only people in your bubbles can see you"
                selected={profileVisibility === "members"}
                onClick={() => setProfileVisibility("members")}
                testId="radio-members"
              />
              <RadioRow
                label="Private"
                sublabel="Only you can see your full profile"
                selected={profileVisibility === "private"}
                onClick={() => setProfileVisibility("private")}
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
                value={showInterests}
                onChange={setShowInterests}
                testId="toggle-show-interests"
              />
              <Toggle
                label="My Bubbles"
                sublabel="Show which communities you belong to"
                value={showBubbles}
                onChange={setShowBubbles}
                testId="toggle-show-bubbles"
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
