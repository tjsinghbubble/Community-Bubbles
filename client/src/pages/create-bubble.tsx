import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Plus,
  Trash2,
  X,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import interestPets from "@/assets/images/interest-pets.jpg";
import exploreMeetup from "@/assets/images/explore-meetup.jpg";
import exploreFood from "@/assets/images/explore-food.jpg";
import catArtsCrafts from "@/assets/images/interest-crafts.jpg";
import catBiking from "@/assets/images/interest-biking.jpg";
import catCoffee from "@/assets/images/interest-coffee.jpg";
import catCommunity from "@/assets/images/explore-meetup.jpg";
import catCooking from "@/assets/images/interest-cooking.jpg";
import catGardening from "@/assets/images/interest-gardening.jpg";
import catHiking from "@/assets/images/interest-hiking.jpg";
import catRunning from "@/assets/images/interest-running.jpg";
import catTennis from "@/assets/images/interest-tennis.jpg";
import catWellness from "@/assets/images/explore-wellness.jpg";
import catYoga from "@/assets/images/explore-wellness.jpg";

const DS = {
  color: {
    text: { primary: "#1E1F26", secondary: "#4D4D4D", tertiary: "#969696", disabled: "#C7C7CC" },
    bg: { primary: "#FFFFFF", secondary: "#FAFAFA", surface: "#F5F6F8", card: "#FFFFFF" },
    border: { default: "#E2E2E2", light: "#F0F0F0", focus: "#35A8F7" },
    status: { error: "#FF3B30" },
    brand: { primary: "#35A8F7", primaryLight: "#5AB9EA" },
    neutral: { black: "#000000" },
  },
  font: { xxs: 9, xs: 10, sm: 11, base: 14, md: 16, lg: 18, xl: 20, xxl: 24, xxxl: 28 },
  lh: { sm: 15, base: 19, md: 22, lg: 25, xl: 27 },
  ls: { tight: -0.5 },
  space: { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 40, huge: 48 },
  radius: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 100, round: 9999 },
  button: { height: 56 },
  modal: { overlayOpacity: 0.4 },
  slider: { trackH: 4, thumbSize: 16 },
} as const;

const CATEGORIES = [
  { label: "Running", image: catRunning },
  { label: "Cooking", image: catCooking },
  { label: "Coffee Meets", image: catCoffee },
  { label: "Professional", image: exploreMeetup },
  { label: "Hiking", image: catHiking },
  { label: "Tennis", image: catTennis },
  { label: "Biking", image: catBiking },
  { label: "Pets", image: interestPets },
  { label: "Arts & Crafts", image: catArtsCrafts },
  { label: "Community", image: catCommunity },
  { label: "Gardening", image: catGardening },
  { label: "Food & Drink", image: exploreFood },
  { label: "Wellness", image: catWellness },
  { label: "Yoga", image: catYoga },
];

const MANDATORY_RULES = [
  "Be Respectful. Treat all members with kindness and courtesy.",
  "Stay On Topic. Keep posts relevant to the bubble's purpose.",
];
const DEFAULT_OPTIONAL_RULE = "Have fun and be yourself!";

const PRIVACY_OPTIONS = [
  { value: "Public", label: "Public", desc: "Anyone can discover and join" },
  { value: "Request", label: "Request to Join", desc: "Admin approval required before joining" },
  { value: "Private", label: "Private", desc: "Invite-only event" },
];

const STEP_LABELS = ["Pick Category", "Bubble Details", "Rules", "Privacy & Settings", "Preview"];

type Step = 0 | 1 | 2 | 3 | 4;

type Draft = {
  category: string;
  title: string;
  tagline: string;
  description: string;
  location: string;
  radiusMiles: number;
  coverFile: File | null;
  coverPreview: string;
  customRules: string[];
  privacy: string;
  memberLimit: string;
};

const blank: Draft = {
  category: "",
  title: "",
  tagline: "",
  description: "",
  location: "",
  radiusMiles: 15,
  coverFile: null,
  coverPreview: "",
  customRules: [],
  privacy: "Public",
  memberLimit: "",
};

function getToken(): string | null {
  return localStorage.getItem("bubble_token");
}

async function apiFetch(url: string, opts: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string> || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (opts.body && typeof opts.body === "string") headers["Content-Type"] = "application/json";
  return fetch(url, { ...opts, headers });
}

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="flex gap-1 px-5 py-3" data-testid="progress-bar">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-1 flex-1 rounded-full transition-colors duration-300"
          style={{
            backgroundColor: i <= step ? DS.color.brand.primary : DS.color.border.light,
            borderRadius: DS.radius.full,
          }}
          data-testid={`progress-segment-${i}`}
        />
      ))}
    </div>
  );
}

function Header({ title, onBack, onCancel }: { title: string; onBack: () => void; onCancel: () => void }) {
  return (
    <div
      className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
      style={{ backgroundColor: DS.color.bg.primary, borderBottom: `1px solid ${DS.color.border.light}` }}
    >
      <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full" data-testid="button-back">
        <ArrowLeft className="h-5 w-5" style={{ color: DS.color.text.primary }} />
      </button>
      <span
        className="font-bold"
        style={{ fontSize: DS.font.md, color: DS.color.text.primary, lineHeight: `${DS.lh.md}px` }}
        data-testid="text-step-title"
      >
        {title}
      </span>
      <button
        onClick={onCancel}
        className="rounded-full px-3 py-2"
        style={{ fontSize: DS.font.base, color: DS.color.text.tertiary }}
        data-testid="button-cancel"
      >
        Cancel
      </button>
    </div>
  );
}

function PrimaryBtn({ label, disabled, onClick, testId }: { label: string; disabled?: boolean; onClick: () => void; testId: string }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="w-full font-semibold transition-opacity"
      style={{
        height: DS.button.height,
        borderRadius: DS.radius.full,
        background: `linear-gradient(135deg, ${DS.color.brand.primary}, #FFFFFF)`,
        fontSize: DS.font.md,
        letterSpacing: DS.ls.tight,
        color: DS.color.text.primary,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      data-testid={testId}
    >
      {label}
    </button>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 px-5 pb-6 pt-4"
      style={{ backgroundColor: DS.color.bg.primary, borderTop: `1px solid ${DS.color.border.light}` }}
    >
      <div className="mx-auto w-full max-w-[420px]">{children}</div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div
      className="mb-2 font-medium"
      style={{ fontSize: DS.font.base, color: DS.color.text.primary }}
    >
      {children}
      {required && <span style={{ color: DS.color.status.error }}> *</span>}
    </div>
  );
}

function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <div className="mt-1 text-right" style={{ fontSize: DS.font.xs, color: DS.color.text.tertiary }}>
      {current}/{max}
    </div>
  );
}

function RadiusSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = ((value - 1) / 49) * 100;
  const ticks = [1, 10, 20, 30, 40, 50];

  const setFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    onChange(Math.round(1 + (x / rect.width) * 49));
  };

  return (
    <div data-testid="slider-radius">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium" style={{ fontSize: DS.font.base, color: DS.color.text.primary }}>
          Radius
        </span>
        <span className="font-semibold" style={{ fontSize: DS.font.base, color: DS.color.brand.primary }}>
          {value} miles
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative cursor-pointer"
        style={{ height: DS.slider.trackH, backgroundColor: DS.color.border.light, borderRadius: DS.radius.full }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          setFromX(e.clientX);
        }}
        onPointerMove={(e) => {
          if ((e.buttons ?? 0) === 0) return;
          setFromX(e.clientX);
        }}
        data-testid="slider-track"
      >
        <div
          className="absolute left-0 top-0 h-full"
          style={{ width: `${pct}%`, backgroundColor: DS.color.brand.primary, borderRadius: DS.radius.full }}
          data-testid="slider-fill"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm"
          style={{
            width: DS.slider.thumbSize,
            height: DS.slider.thumbSize,
            left: `calc(${pct}% - ${DS.slider.thumbSize / 2}px)`,
            backgroundColor: DS.color.bg.primary,
            borderColor: DS.color.border.focus,
            borderRadius: DS.radius.full,
          }}
          data-testid="slider-thumb"
        />
      </div>
      <div className="mt-2 flex justify-between">
        {ticks.map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className="px-0.5"
            style={{
              fontSize: DS.font.xs,
              color: value === t ? DS.color.brand.primary : DS.color.text.tertiary,
              fontWeight: value === t ? 600 : 400,
            }}
            data-testid={`tick-${t}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between">
        <button
          onClick={() => onChange(Math.max(1, value - 1))}
          className="flex h-7 w-7 items-center justify-center rounded-full border"
          style={{ backgroundColor: DS.color.bg.surface, borderColor: DS.color.border.default }}
          data-testid="button-radius-minus"
        >
          <Minus className="h-3.5 w-3.5" style={{ color: DS.color.text.secondary }} />
        </button>
        <button
          onClick={() => onChange(Math.min(50, value + 1))}
          className="flex h-7 w-7 items-center justify-center rounded-full border"
          style={{ backgroundColor: DS.color.bg.surface, borderColor: DS.color.border.default }}
          data-testid="button-radius-plus"
        >
          <Plus className="h-3.5 w-3.5" style={{ color: DS.color.text.secondary }} />
        </button>
      </div>
    </div>
  );
}

function StepCategory({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-5 px-5 pb-32 pt-5">
      <div
        className="font-semibold"
        style={{ fontSize: DS.font.lg, color: DS.color.text.primary, lineHeight: `${DS.lh.lg}px` }}
        data-testid="text-category-prompt"
      >
        What category will your bubble be in?
      </div>
      <div className="grid grid-cols-3 gap-3" data-testid="category-grid">
        {CATEGORIES.map((cat) => {
          const sel = draft.category === cat.label;
          return (
            <button
              key={cat.label}
              className="flex flex-col items-center"
              onClick={() => setDraft({ ...draft, category: sel ? "" : cat.label })}
              data-testid={`category-${cat.label.toLowerCase().replace(/[&\s]+/g, "-")}`}
            >
              <div
                className="relative w-full overflow-hidden"
                style={{
                  borderRadius: DS.radius.md,
                  border: `2px solid ${sel ? DS.color.brand.primary : "transparent"}`,
                }}
              >
                <img src={cat.image} alt={cat.label} className="aspect-square w-full object-cover" />
                {sel && (
                  <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: DS.color.brand.primary }}>
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
              <div
                className="mt-1.5"
                style={{
                  fontSize: DS.font.sm,
                  fontWeight: sel ? 600 : 500,
                  color: sel ? DS.color.brand.primary : DS.color.text.secondary,
                }}
              >
                {cat.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepDetails({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const coverRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-5 px-5 pb-32 pt-5">
      <div>
        <FieldLabel required>Bubble Title</FieldLabel>
        <Input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value.slice(0, 60) })}
          placeholder="Ex: Corgi Fam"
          maxLength={60}
          className="h-12"
          style={{ borderRadius: DS.radius.md, borderColor: DS.color.border.default, fontSize: DS.font.base, color: DS.color.text.primary }}
          data-testid="input-title"
        />
        <CharCount current={draft.title.length} max={60} />
      </div>

      <div>
        <FieldLabel>
          Bubble Tagline <span style={{ fontSize: DS.font.sm, color: DS.color.text.tertiary, fontWeight: 400 }}>(optional)</span>
        </FieldLabel>
        <Input
          value={draft.tagline}
          onChange={(e) => setDraft({ ...draft, tagline: e.target.value.slice(0, 100) })}
          placeholder="Meetup with other Corgi Parents near you"
          maxLength={100}
          className="h-12"
          style={{ borderRadius: DS.radius.md, borderColor: DS.color.border.default, fontSize: DS.font.base, color: DS.color.text.primary }}
          data-testid="input-tagline"
        />
        <CharCount current={draft.tagline.length} max={100} />
      </div>

      <div>
        <FieldLabel required>Bubble Description</FieldLabel>
        <Textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value.slice(0, 500) })}
          placeholder="Tell people what this bubble is about..."
          maxLength={500}
          className="min-h-[120px]"
          style={{ borderRadius: DS.radius.md, borderColor: DS.color.border.default, fontSize: DS.font.base, color: DS.color.text.primary }}
          data-testid="input-description"
        />
        <CharCount current={draft.description.length} max={500} />
      </div>

      <div>
        <FieldLabel>Location</FieldLabel>
        <div className="flex gap-2">
          <Input
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            placeholder="Search location or enter address"
            className="h-12 flex-1"
            style={{ borderRadius: DS.radius.md, borderColor: DS.color.border.default, fontSize: DS.font.base, color: DS.color.text.primary }}
            data-testid="input-location"
          />
          <button
            className="flex h-12 w-12 items-center justify-center border"
            style={{ borderRadius: DS.radius.md, borderColor: DS.color.border.default, backgroundColor: DS.color.bg.primary }}
            data-testid="button-map-pin"
          >
            <MapPin className="h-5 w-5" style={{ color: DS.color.brand.primary }} />
          </button>
        </div>
      </div>

      <RadiusSlider value={draft.radiusMiles} onChange={(v) => setDraft({ ...draft, radiusMiles: v })} />

      <div>
        <FieldLabel>
          Cover Photo <span style={{ fontSize: DS.font.sm, color: DS.color.text.tertiary, fontWeight: 400 }}>(optional)</span>
        </FieldLabel>
        <button
          onClick={() => coverRef.current?.click()}
          className="group relative w-full overflow-hidden border border-dashed transition hover:border-[#35A8F7]"
          style={{ borderRadius: DS.radius.md, borderColor: DS.color.border.default, backgroundColor: DS.color.bg.surface }}
          data-testid="button-cover-upload"
        >
          {draft.coverPreview ? (
            <img src={draft.coverPreview} alt="" className="h-40 w-full object-cover" style={{ aspectRatio: "16/9" }} data-testid="img-cover-preview" />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${DS.color.brand.primary}18` }}>
                <ImagePlus className="h-5 w-5" style={{ color: DS.color.brand.primary }} />
              </div>
              <span className="font-semibold" style={{ fontSize: DS.font.sm, color: DS.color.text.primary }}>+ Add</span>
            </div>
          )}
        </button>
        <input
          ref={coverRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setDraft({ ...draft, coverFile: f, coverPreview: URL.createObjectURL(f) });
          }}
          data-testid="input-cover-file"
        />
      </div>
    </div>
  );
}

function StepRules({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [ruleText, setRuleText] = useState("");

  const openAdd = () => { setEditIdx(null); setRuleText(""); setShowModal(true); };
  const openEdit = (i: number) => { setEditIdx(i); setRuleText(draft.customRules[i]); setShowModal(true); };

  const saveRule = () => {
    const trimmed = ruleText.trim();
    if (!trimmed) return;
    const updated = [...draft.customRules];
    if (editIdx !== null) updated[editIdx] = trimmed;
    else updated.push(trimmed);
    setDraft({ ...draft, customRules: updated });
    setShowModal(false);
  };

  const deleteRule = (i: number) => {
    setDraft({ ...draft, customRules: draft.customRules.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-4 px-5 pb-32 pt-5">
      {MANDATORY_RULES.map((rule, i) => (
        <div
          key={`m-${i}`}
          className="flex items-start gap-3 border p-4"
          style={{ borderRadius: DS.radius.lg, borderColor: DS.color.border.default, backgroundColor: DS.color.bg.card }}
          data-testid={`rule-mandatory-${i}`}
        >
          <div
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-semibold"
            style={{ backgroundColor: DS.color.bg.surface, fontSize: DS.font.xs, color: DS.color.text.secondary }}
          >
            {i + 1}
          </div>
          <div className="flex-1">
            <div style={{ fontSize: DS.font.base, color: DS.color.text.primary, lineHeight: `${DS.lh.base}px` }}>{rule}</div>
            <div
              className="mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5"
              style={{ backgroundColor: DS.color.bg.surface, fontSize: DS.font.xxs, color: DS.color.text.tertiary }}
            >
              <Lock className="h-2.5 w-2.5" /> Required
            </div>
          </div>
        </div>
      ))}

      <div
        className="flex items-start gap-3 border p-4"
        style={{ borderRadius: DS.radius.lg, borderColor: DS.color.border.default, backgroundColor: DS.color.bg.card }}
        data-testid="rule-default"
      >
        <div
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-semibold"
          style={{ backgroundColor: DS.color.bg.surface, fontSize: DS.font.xs, color: DS.color.text.secondary }}
        >
          {MANDATORY_RULES.length + 1}
        </div>
        <div className="flex-1">
          <div style={{ fontSize: DS.font.base, color: DS.color.text.primary, lineHeight: `${DS.lh.base}px` }}>{DEFAULT_OPTIONAL_RULE}</div>
          <div
            className="mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5"
            style={{ backgroundColor: DS.color.bg.surface, fontSize: DS.font.xxs, color: DS.color.text.tertiary }}
          >
            Default
          </div>
        </div>
      </div>

      {draft.customRules.map((rule, i) => (
        <div
          key={`c-${i}`}
          className="flex items-start gap-3 border p-4"
          style={{ borderRadius: DS.radius.lg, borderColor: DS.color.border.default, backgroundColor: DS.color.bg.card }}
          data-testid={`rule-custom-${i}`}
        >
          <div
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-semibold"
            style={{ backgroundColor: DS.color.bg.surface, fontSize: DS.font.xs, color: DS.color.text.secondary }}
          >
            {MANDATORY_RULES.length + 1 + i + 1}
          </div>
          <button onClick={() => openEdit(i)} className="flex-1 text-left" data-testid={`button-edit-rule-${i}`}>
            <div style={{ fontSize: DS.font.base, color: DS.color.text.primary, lineHeight: `${DS.lh.base}px` }}>{rule}</div>
          </button>
          <button onClick={() => deleteRule(i)} className="flex-shrink-0 p-1" data-testid={`button-delete-rule-${i}`}>
            <X className="h-4 w-4" style={{ color: DS.color.text.tertiary }} />
          </button>
        </div>
      ))}

      <button
        onClick={openAdd}
        className="flex w-full items-center justify-center gap-2 border-2 border-dashed py-4 font-semibold"
        style={{
          borderRadius: DS.radius.md,
          borderColor: DS.color.brand.primary,
          fontSize: DS.font.base,
          color: DS.color.brand.primary,
        }}
        data-testid="button-add-rule"
      >
        <Plus className="h-5 w-5" /> Add Rule
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: `rgba(0,0,0,${DS.modal.overlayOpacity})` }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-[480px]"
            style={{
              backgroundColor: DS.color.bg.card,
              borderTopLeftRadius: DS.radius.xl,
              borderTopRightRadius: DS.radius.xl,
              padding: DS.space.lg,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="pb-2 text-center font-bold"
              style={{ fontSize: DS.font.md, color: DS.color.text.primary, lineHeight: `${DS.lh.md}px` }}
            >
              {editIdx !== null ? "Edit Rule" : "Add Rule"}
            </div>
            <Textarea
              value={ruleText}
              onChange={(e) => setRuleText(e.target.value)}
              placeholder="Enter your rule..."
              autoFocus
              className="my-4 min-h-[100px]"
              style={{ borderRadius: DS.radius.md, borderColor: DS.color.border.default, fontSize: DS.font.base, color: DS.color.text.primary }}
              data-testid="input-rule-text"
            />
            <div className="flex gap-3" style={{ gap: DS.space.md }}>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border font-semibold"
                style={{
                  height: DS.button.height,
                  borderRadius: DS.radius.full,
                  borderColor: DS.color.border.default,
                  backgroundColor: DS.color.bg.primary,
                  fontSize: DS.font.md,
                  color: DS.color.text.secondary,
                }}
                data-testid="button-rule-cancel"
              >
                Cancel
              </button>
              <button
                onClick={saveRule}
                disabled={!ruleText.trim()}
                className="flex-1 font-semibold"
                style={{
                  height: DS.button.height,
                  borderRadius: DS.radius.full,
                  background: `linear-gradient(135deg, ${DS.color.brand.primary}, #FFFFFF)`,
                  fontSize: DS.font.md,
                  color: DS.color.text.primary,
                  opacity: ruleText.trim() ? 1 : 0.5,
                }}
                data-testid="button-rule-save"
              >
                {editIdx !== null ? "Save" : "Add Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepPrivacy({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-6 px-5 pb-32 pt-5">
      <div>
        <FieldLabel required>Who Can See This Bubble?</FieldLabel>
        <div className="mt-2 space-y-3">
          {PRIVACY_OPTIONS.map((opt) => {
            const sel = draft.privacy === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setDraft({ ...draft, privacy: opt.value })}
                className="flex w-full items-center gap-3 border p-4 text-left"
                style={{
                  borderRadius: DS.radius.lg,
                  borderColor: sel ? DS.color.brand.primary : DS.color.border.default,
                  backgroundColor: sel ? DS.color.bg.surface : DS.color.bg.card,
                }}
                data-testid={`option-privacy-${opt.value.toLowerCase()}`}
              >
                <div
                  className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2"
                  style={{ borderColor: sel ? DS.color.brand.primary : DS.color.border.default }}
                >
                  {sel && <div className="h-3 w-3 rounded-full" style={{ backgroundColor: DS.color.brand.primary }} />}
                </div>
                <div className="flex-1">
                  <div className="font-semibold" style={{ fontSize: DS.font.base, color: DS.color.text.primary }}>{opt.label}</div>
                  <div style={{ fontSize: DS.font.sm, color: DS.color.text.tertiary }}>{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel>Member Limit</FieldLabel>
        <Input
          value={draft.memberLimit}
          onChange={(e) => setDraft({ ...draft, memberLimit: e.target.value.replace(/[^0-9]/g, "").slice(0, 5) })}
          placeholder="Ex: 20"
          inputMode="numeric"
          maxLength={5}
          className="h-12"
          style={{ borderRadius: DS.radius.md, borderColor: DS.color.border.default, fontSize: DS.font.base, color: DS.color.text.primary }}
          data-testid="input-member-limit"
        />
        <div className="mt-1" style={{ fontSize: DS.font.sm, color: DS.color.text.tertiary }}>
          Leave empty for unlimited
        </div>
      </div>
    </div>
  );
}

function StepPreview({ draft }: { draft: Draft }) {
  const allRules = [...MANDATORY_RULES, DEFAULT_OPTIONAL_RULE, ...draft.customRules];
  const privacyLabel = PRIVACY_OPTIONS.find((p) => p.value === draft.privacy)?.label || draft.privacy;

  return (
    <div className="px-5 pb-32 pt-5">
      <div
        className="overflow-hidden border"
        style={{ borderRadius: DS.radius.lg, borderColor: DS.color.border.default, backgroundColor: DS.color.bg.card }}
        data-testid="preview-card"
      >
        {draft.coverPreview ? (
          <img src={draft.coverPreview} alt="" className="h-44 w-full object-cover" data-testid="preview-cover" />
        ) : (
          <div className="flex h-44 items-center justify-center" style={{ backgroundColor: DS.color.bg.surface }}>
            <ImagePlus className="h-10 w-10" style={{ color: DS.color.text.tertiary }} />
          </div>
        )}

        <div className="p-4 space-y-2" style={{ gap: DS.space.sm }}>
          <div
            className="inline-block rounded-full px-3 py-1"
            style={{ backgroundColor: DS.color.bg.surface, fontSize: DS.font.xs, fontWeight: 600, color: DS.color.text.secondary }}
            data-testid="preview-category"
          >
            {draft.category}
          </div>
          <div className="font-bold" style={{ fontSize: DS.font.xl, color: DS.color.text.primary }} data-testid="preview-title">
            {draft.title}
          </div>
          {draft.tagline && (
            <div style={{ fontSize: DS.font.base, color: DS.color.text.tertiary }} data-testid="preview-tagline">
              {draft.tagline}
            </div>
          )}
          <div className="flex items-center gap-2" style={{ fontSize: DS.font.sm, color: DS.color.text.tertiary }}>
            <span>👥</span> <span data-testid="preview-members">0 members</span>
          </div>
        </div>

        <div style={{ height: 1, backgroundColor: DS.color.border.light, marginLeft: DS.space.lg, marginRight: DS.space.lg }} />

        <div className="p-4 space-y-2">
          <div className="font-semibold" style={{ fontSize: DS.font.base, color: DS.color.text.primary }}>Description</div>
          <div style={{ fontSize: DS.font.base, color: DS.color.text.secondary, lineHeight: `${DS.lh.base}px` }} data-testid="preview-description">
            {draft.description}
          </div>
        </div>

        {draft.location && (
          <>
            <div style={{ height: 1, backgroundColor: DS.color.border.light, marginLeft: DS.space.lg, marginRight: DS.space.lg }} />
            <div className="p-4 space-y-2">
              <div className="font-semibold" style={{ fontSize: DS.font.base, color: DS.color.text.primary }}>Location</div>
              <div className="flex items-center gap-2" style={{ fontSize: DS.font.sm, color: DS.color.text.tertiary }}>
                <MapPin className="h-4 w-4" /> {draft.location} · {draft.radiusMiles} mi radius
              </div>
            </div>
          </>
        )}

        <div style={{ height: 1, backgroundColor: DS.color.border.light, marginLeft: DS.space.lg, marginRight: DS.space.lg }} />

        <div className="p-4 space-y-2">
          <div className="font-semibold" style={{ fontSize: DS.font.base, color: DS.color.text.primary }}>
            Rules ({allRules.length})
          </div>
          {allRules.map((r, i) => (
            <div key={i} style={{ fontSize: DS.font.base, color: DS.color.text.secondary, lineHeight: `${DS.lh.base}px`, paddingBottom: DS.space.xs }} data-testid={`preview-rule-${i}`}>
              {i + 1}. {r}
            </div>
          ))}
        </div>

        <div style={{ height: 1, backgroundColor: DS.color.border.light, marginLeft: DS.space.lg, marginRight: DS.space.lg }} />

        <div className="p-4 space-y-2">
          <div className="font-semibold" style={{ fontSize: DS.font.base, color: DS.color.text.primary }}>Privacy</div>
          <div className="flex items-center gap-2" style={{ fontSize: DS.font.sm, color: DS.color.text.tertiary }}>
            <Lock className="h-4 w-4" /> {privacyLabel}
          </div>
          {draft.memberLimit && (
            <div className="flex items-center gap-2" style={{ fontSize: DS.font.sm, color: DS.color.text.tertiary }}>
              👥 {draft.memberLimit} member limit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginGate({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }
      localStorage.setItem("bubble_token", data.token);
      localStorage.setItem("bubble_user", JSON.stringify(data.user));
      onLoggedIn();
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-6" style={{ backgroundColor: DS.color.bg.secondary }}>
      <div
        className="w-full max-w-[380px] space-y-5 border p-6"
        style={{ borderRadius: DS.radius.xl, borderColor: DS.color.border.default, backgroundColor: DS.color.bg.card }}
      >
        <div className="text-center">
          <div className="font-bold" style={{ fontSize: DS.font.xl, color: DS.color.text.primary }}>Sign in to Bubble</div>
          <div className="mt-1" style={{ fontSize: DS.font.base, color: DS.color.text.tertiary }}>Create bubbles after signing in</div>
        </div>
        {error && (
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: "#FFF2F0", fontSize: DS.font.sm, color: DS.color.status.error }} data-testid="text-login-error">
            {error}
          </div>
        )}
        <div>
          <div className="mb-1 font-medium" style={{ fontSize: DS.font.sm, color: DS.color.text.primary }}>Email</div>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            className="h-12"
            style={{ borderRadius: DS.radius.md, borderColor: DS.color.border.default }}
            data-testid="input-login-email"
          />
        </div>
        <div>
          <div className="mb-1 font-medium" style={{ fontSize: DS.font.sm, color: DS.color.text.primary }}>Password</div>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="h-12"
            style={{ borderRadius: DS.radius.md, borderColor: DS.color.border.default }}
            data-testid="input-login-password"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>
        <PrimaryBtn
          label={loading ? "Signing in..." : "Sign In"}
          disabled={loading || !email || !password}
          onClick={handleLogin}
          testId="button-login-submit"
        />
      </div>
    </div>
  );
}

export default function CreateBubble() {
  const [authed, setAuthed] = useState(!!getToken());
  const [step, setStep] = useState<Step>(0);
  const [draft, setDraft] = useState<Draft>({ ...blank });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const canNext = useMemo(() => {
    switch (step) {
      case 0: return !!draft.category;
      case 1: return !!draft.title.trim() && !!draft.description.trim();
      case 2: return true;
      case 3: return !!draft.privacy;
      case 4: return true;
    }
  }, [step, draft]);

  const goBack = () => {
    if (step > 0) setStep((s) => (s - 1) as Step);
    else window.history.back();
  };

  const goNext = () => {
    if (step < 4) setStep((s) => (s + 1) as Step);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const allRules = [...MANDATORY_RULES, DEFAULT_OPTIONAL_RULE, ...draft.customRules];
      const memberLimitNum = draft.memberLimit && !isNaN(parseInt(draft.memberLimit)) ? parseInt(draft.memberLimit) : null;

      const res = await apiFetch("/api/bubbles", {
        method: "POST",
        body: JSON.stringify({
          title: draft.title.trim(),
          tagline: draft.tagline.trim() || draft.title.trim(),
          category: draft.category,
          description: draft.description.trim(),
          rules: allRules,
          privacy: draft.privacy,
          coverImage: null,
          images: [],
          attachments: [],
          memberLimit: memberLimitNum,
          locationName: draft.location.trim() || null,
          locationAddress: null,
          locationLat: null,
          locationLng: null,
          radiusMiles: draft.radiusMiles,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to create bubble");
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      setSubmitted(true);
    } catch {
      setSubmitError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  if (!authed) {
    return <LoginGate onLoggedIn={() => setAuthed(true)} />;
  }

  if (submitting) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center" style={{ backgroundColor: DS.color.bg.primary }}>
        <Loader2 className="h-12 w-12 animate-spin" style={{ color: DS.color.brand.primary }} />
        <div className="mt-4 font-semibold" style={{ fontSize: DS.font.base, color: DS.color.text.tertiary }}>
          Submitting your bubble...
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-8" style={{ backgroundColor: DS.color.bg.primary }}>
        <div className="text-5xl mb-4" data-testid="celebration-emoji">🎉</div>
        <div className="text-center font-bold" style={{ fontSize: DS.font.xxl, color: DS.color.text.primary }} data-testid="text-success-title">
          Thanks for submitting{"\n"}your bubble
        </div>
        <div className="mt-3 text-center" style={{ fontSize: DS.font.base, color: DS.color.text.tertiary, lineHeight: `${DS.lh.base}px` }} data-testid="text-success-subtitle">
          We'll look over the details and let you know when your bubble is live
        </div>
        <div className="mt-10 w-full max-w-[320px]">
          <PrimaryBtn label="Back to Bubbles" onClick={() => { window.location.href = "/explore"; }} testId="button-back-to-bubbles" />
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 0: return <StepCategory draft={draft} setDraft={setDraft} />;
      case 1: return <StepDetails draft={draft} setDraft={setDraft} />;
      case 2: return <StepRules draft={draft} setDraft={setDraft} />;
      case 3: return <StepPrivacy draft={draft} setDraft={setDraft} />;
      case 4: return <StepPreview draft={draft} />;
    }
  };

  return (
    <div className="min-h-dvh" style={{ backgroundColor: DS.color.bg.primary }}>
      <Header title={STEP_LABELS[step]} onBack={goBack} onCancel={() => window.history.back()} />
      <ProgressBar step={step} />

      {submitError && (
        <div className="mx-5 mt-2 rounded-lg p-3 text-center" style={{ backgroundColor: "#FFF2F0", fontSize: DS.font.sm, color: DS.color.status.error }} data-testid="text-submit-error">
          {submitError}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      <BottomBar>
        <PrimaryBtn
          label={step === 4 ? "Submit for review" : "Next"}
          disabled={!canNext}
          onClick={step === 4 ? handleSubmit : goNext}
          testId={step === 4 ? "button-submit-review" : "button-next"}
        />
      </BottomBar>
    </div>
  );
}
