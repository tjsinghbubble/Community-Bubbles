import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

const FEEDBACK_OPTIONS = ["Bubble", "Event", "Other"] as const;
type FeedbackType = (typeof FEEDBACK_OPTIONS)[number];
type LinkOption = "yes" | "no";

function Pill({
  label,
  selected,
  onClick,
  testId,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "rounded-full border px-4 py-2 text-[13px] font-medium transition",
        selected
          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-semibold"
          : "border-black/15 bg-white text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export default function ReportConcern() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [hasLink, setHasLink] = useState<LinkOption | null>(null);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canProceed = feedbackType !== null && hasLink !== null;
  const canSubmit = name.trim() && date.trim() && description.trim() && fullName.trim() && email.trim();
  const nameLabel = feedbackType === "Event" ? "Event name" : feedbackType === "Other" ? "Name" : "Bubble name";

  const handleBack = () => {
    if (step === 2) setStep(1);
    else navigate("/help-center");
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
  };

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 md:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 ring-1 ring-black/5 text-foreground/70 shadow-sm"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-[20px] font-bold tracking-tight">Report a Concern</h1>
        </div>

        {submitted ? (
          <div className="rounded-2xl bg-white/60 p-6 text-center ring-1 ring-black/5" data-testid="text-concern-success">
            <div className="text-[15px] font-semibold">Submitted</div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Your concern has been submitted. We will review it shortly.
            </p>
            <button
              onClick={() => navigate("/help-center")}
              className="mt-5 rounded-full bg-[hsl(var(--primary))] px-6 py-2.5 text-[13px] font-semibold text-white"
              data-testid="button-concern-done"
            >
              Done
            </button>
          </div>
        ) : step === 1 ? (
          <div className="space-y-6">
            <div>
              <div className="mb-3 text-[14px] font-semibold">What's your feedback about?</div>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_OPTIONS.map((opt) => (
                  <Pill
                    key={opt}
                    label={opt}
                    selected={feedbackType === opt}
                    onClick={() => setFeedbackType(opt)}
                    testId={`option-feedback-${opt.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 text-[14px] font-semibold">Do you have link to the Bubble or Event?</div>
              <div className="flex flex-wrap gap-2">
                <Pill label="Yes, I have the Link" selected={hasLink === "yes"} onClick={() => setHasLink("yes")} testId="option-link-yes" />
                <Pill label="No, I do not have the Link" selected={hasLink === "no"} onClick={() => setHasLink("no")} testId="option-link-no" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <span className="text-[13px] text-muted-foreground">Page 1/2</span>
              <button
                onClick={() => canProceed && setStep(2)}
                disabled={!canProceed}
                className="rounded-full bg-[hsl(var(--primary))] px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
                data-testid="button-next"
              >
                Next
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[12px] text-muted-foreground">All fields are required unless otherwise noted.</p>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium">What's the name?</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={nameLabel}
                className="w-full rounded-xl bg-white/70 px-4 py-3 text-[13px] ring-1 ring-black/10 outline-none focus:ring-[hsl(var(--primary))]"
                data-testid="input-name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium">When did this take place</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl bg-white/70 px-4 py-3 text-[13px] ring-1 ring-black/10 outline-none focus:ring-[hsl(var(--primary))]"
                data-testid="input-date"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium">Describe the situation</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened..."
                rows={5}
                className="w-full resize-none rounded-xl bg-white/70 p-4 text-[13px] leading-relaxed ring-1 ring-black/10 outline-none focus:ring-[hsl(var(--primary))]"
                data-testid="input-description"
              />
            </div>

            <div className="pt-2">
              <div className="text-[14px] font-semibold">Your contact details</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Your information will not be shared with the Bubble or Event Admins
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="w-full rounded-xl bg-white/70 px-4 py-3 text-[13px] ring-1 ring-black/10 outline-none focus:ring-[hsl(var(--primary))]"
                data-testid="input-full-name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-xl bg-white/70 px-4 py-3 text-[13px] ring-1 ring-black/10 outline-none focus:ring-[hsl(var(--primary))]"
                data-testid="input-email"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <button onClick={() => setStep(1)} className="text-[13px] font-semibold text-[hsl(var(--primary))]" data-testid="button-step-back">
                Back
              </button>
              <span className="text-[13px] text-muted-foreground">Page 2/2</span>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="rounded-full bg-[hsl(var(--primary))] px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
                data-testid="button-submit"
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
