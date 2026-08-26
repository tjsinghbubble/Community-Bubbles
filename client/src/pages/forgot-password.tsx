import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { AuthCard } from "@/components/AuthCard";

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [email, setEmail] = useState(() => new URLSearchParams(search).get("email") || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      navigate(`/reset-password?email=${encodeURIComponent(trimmed)}`);
    } catch (err: any) {
      setError(err.message || "Failed to send code. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter the email address linked to your account and we'll send you a code to reset your password."
      onBack={() => { window.location.href = "/"; }}
    >
      <div>
        <label className="mb-1.5 block text-[13px] font-medium">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
          data-testid="input-email"
          autoFocus
        />
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600 ring-1 ring-red-100" data-testid="text-error">
          {error}
        </div>
      ) : null}

      <button
        onClick={submit}
        disabled={!email.trim() || submitting}
        className="h-12 w-full rounded-2xl text-[14px] font-semibold text-white disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
        data-testid="button-send-reset-code"
      >
        {submitting ? "Sending…" : "Send Reset Code"}
      </button>
    </AuthCard>
  );
}
