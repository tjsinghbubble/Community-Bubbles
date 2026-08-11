import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";

const MAX_LENGTH = 2000;

export function FeedbackForm({
  title,
  heading,
  body,
  placeholder,
  type,
  submitLabel,
  successTitle,
  successBody,
}: {
  title: string;
  heading: string;
  body: string;
  placeholder: string;
  type: "feedback" | "feature_request" | "defect_report";
  submitLabel: string;
  successTitle: string;
  successBody: string;
}) {
  const [, navigate] = useLocation();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("POST", "/api/feedback", { type, message: trimmed });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 md:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate("/get-help")}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 ring-1 ring-black/5 text-foreground/70 shadow-sm"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-[20px] font-bold tracking-tight">{title}</h1>
        </div>

        {submitted ? (
          <div
            className="rounded-2xl bg-white/60 p-6 text-center ring-1 ring-black/5"
            data-testid="text-feedback-success"
          >
            <div className="text-[15px] font-semibold">{successTitle}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{successBody}</p>
            <button
              onClick={() => navigate("/get-help")}
              className="mt-5 rounded-full bg-[hsl(var(--primary))] px-6 py-2.5 text-[13px] font-semibold text-white"
              data-testid="button-feedback-done"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-[15px] font-semibold">{heading}</div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{body}</p>

            <div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
                placeholder={placeholder}
                rows={7}
                className="w-full resize-none rounded-2xl bg-white/70 p-4 text-[13px] leading-relaxed ring-1 ring-black/10 outline-none focus:ring-[hsl(var(--primary))]"
                data-testid="input-feedback-message"
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground">
                {message.length}/{MAX_LENGTH}
              </div>
            </div>

            {error ? (
              <div className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600 ring-1 ring-red-100" data-testid="text-feedback-error">
                {error}
              </div>
            ) : null}

            <button
              onClick={submit}
              disabled={!message.trim() || submitting}
              className="w-full rounded-full bg-[hsl(var(--primary))] py-3.5 text-center text-[14px] font-semibold text-white disabled:opacity-40"
              data-testid="button-submit-feedback"
            >
              {submitting ? "Submitting…" : submitLabel}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
