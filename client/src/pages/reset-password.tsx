import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { AuthCard } from "@/components/AuthCard";
import { CodeInput, codeIsComplete, emptyCode } from "@/components/CodeInput";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const email = new URLSearchParams(search).get("email") || "";

  const [code, setCode] = useState(emptyCode());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!email) navigate("/forgot-password", { replace: true });
  }, [email]);

  const isFormValid = codeIsComplete(code) && password.length >= 8 && password === confirmPassword;

  const resend = async () => {
    setResending(true);
    setResendMessage(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to resend");
      setResendMessage("A new code has been sent to your email.");
    } catch (err: any) {
      setError(err.message || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  const submit = async () => {
    if (!isFormValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.join(""), newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reset failed");
      window.location.href = `/?email=${encodeURIComponent(email)}`;
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Enter your code"
      subtitle={`We sent a 6-digit code to ${email}. Enter it below along with your new password.`}
      onBack={() => navigate("/forgot-password")}
    >
      <CodeInput value={code} onChange={setCode} disabled={submitting} />

      <div className="text-center">
        <button
          onClick={resend}
          disabled={resending}
          className="text-[12px] font-semibold text-[hsl(var(--primary))] underline-offset-2 hover:underline disabled:opacity-60"
          data-testid="button-resend-code"
        >
          {resending ? "Sending…" : "Didn't get a code? Send again"}
        </button>
      </div>
      {resendMessage ? (
        <div className="text-center text-[12px] text-emerald-600" data-testid="text-resend-success">
          {resendMessage}
        </div>
      ) : null}

      <div>
        <label className="mb-1.5 block text-[13px] font-medium">New Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 pr-11 text-[14px] outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
            data-testid="input-new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-medium">Confirm Password</label>
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your new password"
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 pr-11 text-[14px] outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
            data-testid="input-confirm-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirmPassword && password !== confirmPassword ? (
          <p className="mt-1 text-[11px] text-red-500">Passwords do not match.</p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600 ring-1 ring-red-100" data-testid="text-error">
          {error}
        </div>
      ) : null}

      <button
        onClick={submit}
        disabled={!isFormValid || submitting}
        className="h-12 w-full rounded-2xl text-[14px] font-semibold text-white disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
        data-testid="button-reset-password"
      >
        {submitting ? "Resetting…" : "Reset Password"}
      </button>
    </AuthCard>
  );
}
