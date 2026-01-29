import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Check,
  ImagePlus,
  Loader2,
  MapPin,
  Minus,
  Plus,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import successIllustration from "@/assets/images/bubble-submit-success.png";

type Privacy = "public" | "request" | "private";

type Draft = {
  title: string;
  tagline: string;
  description: string;
  location: string;
  radiusMiles: number;
  coverPreviewUrl?: string;
  privacy: Privacy;
  memberLimit: string;
};

const defaultDraft: Draft = {
  title: "",
  tagline: "",
  description: "",
  location: "",
  radiusMiles: 15,
  privacy: "public",
  memberLimit: "",
};

function TopRow({ title, onBack, onCancel }: { title: string; onBack: () => void; onCancel: () => void }) {
  return (
    <div className="sticky top-0 z-20 bg-background/85 backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={onBack}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5 backdrop-blur"
          data-testid="button-create-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-[15px] font-semibold tracking-tight" data-testid="text-create-title">
          {title}
        </div>
        <button
          onClick={onCancel}
          className="rounded-full px-3 py-2 text-[13px] font-semibold text-red-500"
          data-testid="button-create-cancel"
        >
          Cancel
        </button>
      </div>
      <div className="h-[3px] w-full bg-black/5">
        <div
          className="h-full w-1/3"
          style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
          data-testid="progress-create"
        />
      </div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div className="mb-2 text-[13px] font-semibold text-foreground" data-testid="text-field-label">
      {children} {required ? <span className="text-red-500">*</span> : null}
    </div>
  );
}

function Slider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const pct = useMemo(() => {
    const min = 1;
    const max = 50;
    return ((value - min) / (max - min)) * 100;
  }, [value]);

  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const min = 1;
    const max = 50;
    const next = Math.round(min + (x / rect.width) * (max - min));
    onChange(next);
  };

  return (
    <div className="mt-3" data-testid="slider-radius">
      <div
        ref={trackRef}
        className="relative h-2 rounded-full bg-black/10"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          setFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if ((e.buttons ?? 0) === 0) return;
          setFromClientX(e.clientX);
        }}
        data-testid="slider-track"
      >
        <div
          className="absolute left-0 top-0 h-2 rounded-full"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
          data-testid="slider-fill"
        />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-[0_10px_30px_hsl(var(--foreground)/0.22)] ring-1 ring-black/10"
          style={{ left: `calc(${pct}% - 10px)` }}
          data-testid="slider-thumb"
        />
      </div>

      <div className="mt-3 text-center text-[13px] text-muted-foreground" data-testid="text-radius-value">
        {value} miles
      </div>
    </div>
  );
}

function OptionRow({
  title,
  description,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border bg-white/55 p-4 text-left shadow-sm ring-1 ring-black/5 transition",
        selected ? "border-[hsl(var(--primary))]" : "border-transparent",
      )}
      data-testid={`option-privacy-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 grid h-5 w-5 place-items-center rounded-full border",
            selected ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]" : "border-black/20 bg-white",
          )}
          data-testid="radio"
        >
          {selected ? <div className="h-2 w-2 rounded-full bg-white" /> : null}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold" data-testid="text-option-title">
            {title}
          </div>
          <div className="mt-1 text-[12px] leading-snug text-muted-foreground" data-testid="text-option-description">
            {description}
          </div>
        </div>
      </div>
    </button>
  );
}

function CoverUploader({
  previewUrl,
  onPick,
}: {
  previewUrl?: string;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="mt-4">
      <div className="text-[13px] font-semibold" data-testid="text-cover-title">
        Add a Cover Photo <span className="font-medium text-muted-foreground">(Strongly Recommended)</span>
      </div>

      <div className="mt-3">
        <button
          onClick={() => inputRef.current?.click()}
          className={cn(
            "group relative w-full overflow-hidden rounded-2xl border border-dashed border-black/20 bg-white/45 px-4 py-5 text-sm text-muted-foreground transition",
            "hover:border-[hsl(var(--primary))]/50 hover:bg-white/55",
          )}
          data-testid="button-add-cover"
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="h-36 w-full rounded-xl object-cover"
              data-testid="img-cover-preview"
            />
          ) : (
            <div className="flex h-36 flex-col items-center justify-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                <ImagePlus className="h-5 w-5" />
              </div>
              <div className="text-[13px] font-semibold text-foreground">+ Add</div>
            </div>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            onPick(f);
          }}
          data-testid="input-cover-file"
        />

        <button
          className="mt-3 w-full rounded-2xl border border-black/10 bg-white/55 py-4 text-[13px] font-semibold text-[hsl(var(--primary))] shadow-sm"
          data-testid="button-add-attachments"
        >
          Add Attachments
        </button>
      </div>
    </div>
  );
}

function PrimaryCTA({ label, disabled, onClick, testId }: { label: string; disabled?: boolean; onClick: () => void; testId: string }) {
  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      className="h-12 w-full rounded-full text-[14px] font-semibold shadow-[0_18px_55px_hsl(var(--primary)/0.30)]"
      style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
      data-testid={testId}
    >
      {label}
    </Button>
  );
}

function BubbleDetails({
  draft,
  setDraft,
  onNext,
  onBack,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const requiredOk = draft.title.trim().length > 0 && draft.description.trim().length > 0 && draft.location.trim().length > 0;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopRow title="Bubble Details" onBack={onBack} onCancel={onCancel} />

      <div className="mx-auto w-full max-w-[420px] px-5 pb-28 pt-5">
        <div className="space-y-5">
          <div>
            <FieldLabel required>Bubble Title</FieldLabel>
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Ex: Corgi Fam"
              className="h-12 rounded-2xl bg-white/55"
              data-testid="input-bubble-title"
            />
          </div>

          <div>
            <FieldLabel>Bubble Tagline (optional)</FieldLabel>
            <Input
              value={draft.tagline}
              onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              placeholder="Meetup with other Corgi Parents near you"
              className="h-12 rounded-2xl bg-white/55"
              data-testid="input-bubble-tagline"
            />
          </div>

          <div>
            <FieldLabel required>Bubble Description</FieldLabel>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Fluffy but fierce. We’re a pack of corgi lovers who meet up for park hangs, group walks, and the occasional costume parade.\n\nEvents, tips, memes, and good vibes only."
              className="min-h-[140px] rounded-2xl bg-white/55"
              data-testid="input-bubble-description"
            />
          </div>

          <div>
            <FieldLabel required>Location</FieldLabel>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="Search location or enter address"
                className="h-12 rounded-2xl bg-white/55 pl-11"
                data-testid="input-bubble-location"
              />
            </div>

            <Slider value={draft.radiusMiles} onChange={(v) => setDraft({ ...draft, radiusMiles: v })} />
          </div>

          <CoverUploader
            previewUrl={draft.coverPreviewUrl}
            onPick={(file) => {
              const url = URL.createObjectURL(file);
              setDraft({ ...draft, coverPreviewUrl: url });
            }}
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-background via-background/85 to-transparent px-4 pb-5 pt-3">
        <div className="w-full max-w-[420px]">
          <PrimaryCTA label="Next" disabled={!requiredOk} onClick={onNext} testId="button-details-next" />
        </div>
      </div>
    </div>
  );
}

function PrivacySettings({
  draft,
  setDraft,
  onNext,
  onBack,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopRow title="Privacy & Settings" onBack={onBack} onCancel={onCancel} />

      <div className="mx-auto w-full max-w-[420px] px-5 pb-28 pt-5">
        <div className="text-[13px] font-semibold" data-testid="text-privacy-title">
          Who Can See This Bubble?
        </div>

        <div className="mt-3 space-y-3">
          <OptionRow
            title="Public"
            description="Anyone can discover and join"
            selected={draft.privacy === "public"}
            onSelect={() => setDraft({ ...draft, privacy: "public" })}
          />
          <OptionRow
            title="Request to Join"
            description="Host approval required before attending"
            selected={draft.privacy === "request"}
            onSelect={() => setDraft({ ...draft, privacy: "request" })}
          />
          <OptionRow
            title="Private"
            description="Invite-only event"
            selected={draft.privacy === "private"}
            onSelect={() => setDraft({ ...draft, privacy: "private" })}
          />
        </div>

        <div className="mt-6">
          <div className="mb-2 text-[13px] font-semibold" data-testid="text-memberlimit-title">
            Member Limit
          </div>
          <Input
            value={draft.memberLimit}
            onChange={(e) => setDraft({ ...draft, memberLimit: e.target.value })}
            placeholder="Ex: 20"
            inputMode="numeric"
            className="h-12 rounded-2xl bg-white/55"
            data-testid="input-member-limit"
          />
          <div className="mt-2 text-[11px] text-muted-foreground" data-testid="text-memberlimit-hint">
            Leave empty for unlimited
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-background via-background/85 to-transparent px-4 pb-5 pt-3">
        <div className="w-full max-w-[420px]">
          <PrimaryCTA label="Next" onClick={onNext} testId="button-privacy-next" />
        </div>
      </div>
    </div>
  );
}

function PreviewSubmit({
  draft,
  onSubmit,
  onBack,
  onCancel,
}: {
  draft: Draft;
  onSubmit: () => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopRow title={draft.title.trim() ? draft.title.trim() : "Bubble Preview"} onBack={onBack} onCancel={onCancel} />

      <div className="mx-auto w-full max-w-[420px] px-5 pb-28 pt-5">
        <Card className="overflow-hidden rounded-[26px] border-0 bg-white/55 shadow-sm ring-1 ring-black/5">
          <div className="relative aspect-[4/3]">
            {draft.coverPreviewUrl ? (
              <img
                src={draft.coverPreviewUrl}
                alt=""
                className="h-full w-full object-cover"
                data-testid="img-preview-cover"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary) / .14), hsl(var(--brand-2) / .10)), radial-gradient(800px circle at 30% 20%, hsl(var(--primary) / .12), transparent 55%)",
                }}
                data-testid="img-preview-fallback"
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
          </div>

          <div className="px-5 pb-5 pt-4">
            {draft.tagline.trim() ? (
              <div className="text-center text-[13px] font-semibold text-muted-foreground" data-testid="text-preview-tagline">
                {draft.tagline.trim()}
              </div>
            ) : null}

            <div className="mt-2 text-center text-[11px] text-muted-foreground" data-testid="text-preview-meta">
              {draft.memberLimit.trim() ? `${draft.memberLimit.trim()} members allowed` : "Unlimited members"}
            </div>

            <div className="mt-5">
              <div className="text-[13px] font-semibold" data-testid="text-preview-about-title">
                About
              </div>
              <div className="mt-2 text-[12px] leading-relaxed text-muted-foreground" data-testid="text-preview-about">
                {draft.description.trim() || "—"}
              </div>
            </div>

            <div className="mt-5">
              <div className="text-[13px] font-semibold" data-testid="text-preview-location-title">
                Location
              </div>
              <div className="mt-2 text-[12px] text-muted-foreground" data-testid="text-preview-location">
                {draft.location.trim() || "—"} • Radius: {draft.radiusMiles} miles
              </div>

              <div className="mt-3 overflow-hidden rounded-2xl bg-black/5" data-testid="map-preview">
                <div
                  className="h-36 w-full"
                  style={{
                    background:
                      "radial-gradient(700px circle at 40% 30%, rgba(0,0,0,.10), transparent 55%), linear-gradient(135deg, rgba(0,0,0,.06), rgba(0,0,0,.02))",
                  }}
                />
                <div className="px-4 py-3 text-[11px] text-muted-foreground">
                  This is a mock map preview.
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-[13px] font-semibold" data-testid="text-preview-rules-title">
                Bubble Rules
              </div>
              <div className="mt-2 text-[12px] text-muted-foreground" data-testid="text-preview-rules">
                No hate. Be kind. Keep it local.
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-background via-background/85 to-transparent px-4 pb-5 pt-3">
        <div className="w-full max-w-[420px]">
          <PrimaryCTA label="Submit for review" onClick={onSubmit} testId="button-submit-review" />
        </div>
      </div>
    </div>
  );
}

function Submitting({ onDone }: { onDone: () => void }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[420px] flex-col items-center justify-center px-6 py-10">
        <div className="relative grid h-44 w-44 place-items-center" data-testid="loading-wrapper">
          <div className="absolute inset-0 rounded-full border-[10px] border-black/10" />
          <div
            className="absolute inset-0 rounded-full border-[10px] border-transparent"
            style={{
              borderTopColor: "hsl(var(--primary))",
              borderRightColor: "hsl(var(--brand-2))",
              borderBottomColor: "rgba(0,0,0,.06)",
              borderLeftColor: "rgba(0,0,0,.06)",
              animation: "spin 1.1s linear infinite",
            }}
          />
        </div>
        <div className="mt-6 text-[15px] font-semibold" data-testid="text-loading">
          Loading...
        </div>
      </div>
    </div>
  );
}

function Submitted({ onBackToBubbles }: { onBackToBubbles: () => void }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[420px] flex-col items-center px-6 pb-10 pt-14">
        <div className="text-center">
          <div className="text-[15px] font-semibold" data-testid="text-submitted-title">
            Thanks for submitting your bubble
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-muted-foreground" data-testid="text-submitted-subtitle">
            We’ll look over the details and let you know when your bubble is live.
          </div>
        </div>

        <div className="mt-8 grid place-items-center" data-testid="img-submitted-illustration">
          <img src={successIllustration} alt="" className="h-48 w-48 object-contain" />
        </div>

        <div className="mt-10 w-full">
          <PrimaryCTA label="Back to Bubbles" onClick={onBackToBubbles} testId="button-back-to-bubbles" />
        </div>
      </div>
    </div>
  );
}

export default function CreateBubble() {
  const [step, setStep] = useState<"details" | "privacy" | "preview" | "submitting" | "submitted">("details");
  const [draft, setDraft] = useState<Draft>(defaultDraft);

  const goBack = () => {
    setStep((s) => {
      if (s === "privacy") return "details";
      if (s === "preview") return "privacy";
      return s;
    });
  };

  return (
    <div className="min-h-dvh">
      <AnimatePresence mode="wait">
        {step === "details" ? (
          <motion.div key="details" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
            <BubbleDetails
              draft={draft}
              setDraft={setDraft}
              onBack={() => history.back()}
              onCancel={() => history.back()}
              onNext={() => setStep("privacy")}
            />
          </motion.div>
        ) : null}

        {step === "privacy" ? (
          <motion.div key="privacy" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
            <PrivacySettings
              draft={draft}
              setDraft={setDraft}
              onBack={goBack}
              onCancel={() => history.back()}
              onNext={() => setStep("preview")}
            />
          </motion.div>
        ) : null}

        {step === "preview" ? (
          <motion.div key="preview" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
            <PreviewSubmit
              draft={draft}
              onBack={goBack}
              onCancel={() => history.back()}
              onSubmit={() => {
                setStep("submitting");
                window.setTimeout(() => setStep("submitted"), 1300);
              }}
            />
          </motion.div>
        ) : null}

        {step === "submitting" ? (
          <motion.div key="submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <Submitting onDone={() => setStep("submitted")} />
          </motion.div>
        ) : null}

        {step === "submitted" ? (
          <motion.div key="submitted" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <Submitted
              onBackToBubbles={() => {
                window.location.href = "/explore";
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
