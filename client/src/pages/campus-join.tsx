import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { CodeInput, codeIsComplete, emptyCode } from "@/components/CodeInput";

export default function CampusJoin() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [step, setStep] = useState<"email" | "code" | "success">("email");
  const [email, setEmail] = useState("");
  const [campusName, setCampusName] = useState("");
  const [code, setCode] = useState(emptyCode());
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const isValidEduEmail = /^[^\s@]+@[^\s@]+\.edu$/i.test(email.trim());

  const sendCode = async () => {
    if (!isValidEduEmail || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiRequest("POST", "/api/campus/send-verification", { email: email.trim() });
      const data = await res.json();
      setCampusName(data.campusName);
      setStep("code");
    } catch (err: any) {
      setError(err.message || "Failed to send verification code");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setResendMessage(null);
    try {
      await apiRequest("POST", "/api/campus/send-verification", { email: email.trim() });
      setResendMessage("A new code has been sent to your email.");
    } catch (err: any) {
      setError(err.message || "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  const verify = async () => {
    if (!codeIsComplete(code) || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("POST", "/api/campus/verify-code", { email: email.trim(), code: code.join("") });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Invalid verification code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell active="explore">
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-4 md:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => (step === "email" ? navigate("/explore") : setStep("email"))}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 ring-1 ring-black/5 text-foreground/70 shadow-sm"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-[20px] font-bold tracking-tight">Join Your Campus</h1>
        </div>

        <div className="rounded-2xl bg-white/60 p-6 ring-1 ring-black/5">
          {step === "email" && (
            <>
              <div className="mb-4 flex justify-center">
                <GraduationCap className="h-12 w-12" style={{ color: "#35A8F7" }} />
              </div>
              <h2 className="text-center text-[18px] font-bold">Join your campus community!</h2>
              <p className="mt-2 text-center text-[13px] leading-relaxed text-muted-foreground">
                Find bubbles for classes, clubs, and common interests shared by people at your school.
              </p>

              <div className="mt-6">
                <label className="mb-1.5 block text-[13px] font-medium">School email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendCode()}
                  placeholder="you@university.edu"
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
                  data-testid="input-campus-email"
                  autoFocus
                />
              </div>

              {error && (
                <div className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600 ring-1 ring-red-100" data-testid="text-error">
                  {error}
                </div>
              )}

              <button
                onClick={sendCode}
                disabled={!isValidEduEmail || submitting}
                className="mt-5 h-12 w-full rounded-2xl text-[14px] font-semibold text-white disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #35A8F7, #6C63FF)" }}
                data-testid="button-verify-edu-email"
              >
                {submitting ? "Sending…" : "Verify My .edu Email"}
              </button>
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                Bubble is not managed by or affiliated with your school.
              </p>
            </>
          )}

          {step === "code" && (
            <>
              <h2 className="text-center text-[18px] font-bold">Enter your code</h2>
              <p className="mt-2 text-center text-[13px] leading-relaxed text-muted-foreground">
                We sent a 6-digit code to {email} for {campusName}.
              </p>

              <div className="mt-6">
                <CodeInput value={code} onChange={setCode} disabled={submitting} />
              </div>

              <div className="mt-3 text-center">
                <button
                  onClick={resend}
                  disabled={resending}
                  className="text-[12px] font-semibold text-[hsl(var(--primary))] underline-offset-2 hover:underline disabled:opacity-60"
                  data-testid="button-resend-code"
                >
                  {resending ? "Sending…" : "Didn't get a code? Send again"}
                </button>
              </div>
              {resendMessage && (
                <div className="mt-2 text-center text-[12px] text-emerald-600" data-testid="text-resend-success">
                  {resendMessage}
                </div>
              )}

              {error && (
                <div className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600 ring-1 ring-red-100" data-testid="text-error">
                  {error}
                </div>
              )}

              <button
                onClick={verify}
                disabled={!codeIsComplete(code) || submitting}
                className="mt-5 h-12 w-full rounded-2xl text-[14px] font-semibold text-white disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #35A8F7, #6C63FF)" }}
                data-testid="button-verify-code"
              >
                {submitting ? "Verifying…" : "Verify"}
              </button>
            </>
          )}

          {step === "success" && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-100">
                <GraduationCap className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-[18px] font-bold" data-testid="text-campus-success">
                Welcome to {campusName}!
              </h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Your campus is verified. You can now see campus-exclusive bubbles and events.
              </p>
              <button
                onClick={() => navigate("/explore")}
                className="mt-5 h-11 w-full rounded-2xl text-[14px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #35A8F7, #6C63FF)" }}
                data-testid="button-campus-done"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
