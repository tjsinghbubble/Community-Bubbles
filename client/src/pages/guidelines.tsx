import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

type PendingSignup = { name: string; email: string; password: string; interests: string[] };

const GUIDELINES: { id: string; title: string; description?: string; bullets?: string[] }[] = [
  { id: "kind", title: "Be Kind", description: "No bullying, harassment, or hateful behavior" },
  {
    id: "privacy",
    title: "Respect Privacy",
    description: "Don't share anyone's personal info, screenshots, or messages without permission",
  },
  { id: "safe", title: "Keep It Safe", description: "No threats, dangerous behavior, or anything that could harm others" },
  { id: "scams", title: "No Scams or Spam", description: "No fraud, promotions, or unwanted selling unless the Bubble allows it" },
  {
    id: "content",
    title: "Keep Content Appropriate",
    bullets: [
      "No graphic violence or gore",
      "No illegal content or promotion of illegal activities",
      "No misinformation intended to deceive or harm others",
    ],
  },
  { id: "showup", title: "Show Up", description: "Honor your commitments, whether you're hosting or attending" },
];

const WARNING = {
  title: "Please Keep In Mind",
  description:
    "Violations of these guidelines will result in warnings. Continued violations may lead to removal from Bubbles or account termination.",
};

function readPendingSignup(): PendingSignup | null {
  try {
    const raw = sessionStorage.getItem("bubble_pending_signup");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Guidelines() {
  const [, navigate] = useLocation();
  const { signup } = useAuth();
  const [pending, setPending] = useState<PendingSignup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const data = readPendingSignup();
    if (!data) {
      navigate("/", { replace: true });
      return;
    }
    setPending(data);
  }, []);

  const handleAgree = async () => {
    if (!pending || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signup(pending);
      sessionStorage.removeItem("bubble_pending_signup");
      navigate("/explore");
    } catch (err: any) {
      if (/already exists/i.test(err.message || "")) {
        sessionStorage.removeItem("bubble_pending_signup");
        window.location.href = `/?email=${encodeURIComponent(pending.email)}`;
        return;
      }
      setError(err.message || "Sign up failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (!pending) return null;

  return (
    <div className="min-h-dvh bg-background pb-32">
      <div className="sticky top-0 z-10 bg-background/85 px-5 pb-3 pt-5 text-center backdrop-blur-xl">
        <div className="mx-auto mb-3 h-1 max-w-xs rounded-full bg-[hsl(var(--primary))]" />
        <h1 className="text-[15px] font-bold" data-testid="text-title">
          Our Community Guidelines
        </h1>
      </div>

      <div className="mx-auto w-full max-w-lg px-5 pt-2">
        <h2 className="mb-4 text-[15px] font-semibold" data-testid="text-section-title">
          Let's Keep This Space Safe
        </h2>

        <div className="space-y-2">
          {GUIDELINES.map((g) => (
            <div key={g.id} className="rounded-2xl bg-[#F5F6F8] p-3" data-testid={`card-guideline-${g.id}`}>
              <div className="text-[14px] font-semibold">{g.title}</div>
              {g.description ? <div className="mt-0.5 text-[13px]">{g.description}</div> : null}
              {g.bullets ? (
                <ul className="mt-1 space-y-0.5 pl-4">
                  {g.bullets.map((b, i) => (
                    <li key={i} className="list-disc text-[13px]">
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}

          <div className="rounded-2xl border border-[hsl(var(--primary))] bg-[#F5F6F8] p-3" data-testid="card-warning">
            <div className="text-[14px] font-semibold">{WARNING.title}</div>
            <div className="mt-0.5 text-[13px]">{WARNING.description}</div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600 ring-1 ring-red-100" data-testid="text-error">
            {error}
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 bg-background/95 px-5 pb-6 pt-4 backdrop-blur-xl">
        <button
          onClick={handleAgree}
          disabled={submitting}
          className="mx-auto h-12 w-full max-w-lg rounded-2xl text-[14px] font-semibold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
          data-testid="button-agree"
        >
          {submitting ? "Joining…" : "I Agree"}
        </button>
      </div>
    </div>
  );
}
