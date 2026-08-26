import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { AuthCard } from "@/components/AuthCard";
import { CodeInput, codeIsComplete, emptyCode } from "@/components/CodeInput";

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const email = new URLSearchParams(search).get("email") || "";

  const [code, setCode] = useState(emptyCode());
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!email || !sessionStorage.getItem("bubble_pending_signup")) {
      navigate("/", { replace: true });
    }
  }, [email]);

  const resend = async () => {
    setResending(true);
    setResendMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send new code");
      if (data.devCode) {
        setResendMessage(`A new code has been sent (dev code: ${data.devCode}).`);
      } else {
        setResendMessage("A new code has been sent to your email.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to send new code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const submit = async () => {
    if (!codeIsComplete(code) || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.join("") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Invalid verification code");
      navigate("/guidelines");
    } catch (err: any) {
      setError(err.message || "Failed to verify code. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Verify your email"
      subtitle={`Enter the 6-digit code sent to ${email}. The code is valid for 30 minutes.`}
      onBack={() => { window.location.href = "/"; }}
    >
      <CodeInput value={code} onChange={setCode} disabled={submitting} />

      <div className="text-center">
        <button
          onClick={resend}
          disabled={resending}
          className="text-[12px] font-semibold text-[hsl(var(--primary))] underline-offset-2 hover:underline disabled:opacity-60"
          data-testid="button-resend-code"
        >
          {resending ? "Sending…" : "Send new code"}
        </button>
      </div>
      {resendMessage ? (
        <div className="text-center text-[12px] text-emerald-600" data-testid="text-resend-success">
          {resendMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600 ring-1 ring-red-100" data-testid="text-error">
          {error}
        </div>
      ) : null}

      <button
        onClick={submit}
        disabled={!codeIsComplete(code) || submitting}
        className="h-12 w-full rounded-2xl text-[14px] font-semibold text-white disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
        data-testid="button-verify"
      >
        {submitting ? "Verifying…" : "Verify"}
      </button>
    </AuthCard>
  );
}
