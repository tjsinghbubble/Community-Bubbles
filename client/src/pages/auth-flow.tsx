import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lock,
  Mail,
  Shield,
  Sparkles,
} from "lucide-react";

import mosaicImg from "@/assets/images/bubble-mosaic.png";
import gradientImg from "@/assets/images/bubble-blue-gradient.png";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

const screens = ["welcome", "details", "verify", "verifyFilled"] as const;
type Screen = (typeof screens)[number];

type AccountDetails = {
  legalName: string;
  gender: string;
  dob: string;
  email: string;
};

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(900px circle at 20% 10%, hsl(var(--primary) / .16), transparent 52%), radial-gradient(900px circle at 90% 25%, hsl(var(--brand-2) / .14), transparent 55%), radial-gradient(900px circle at 50% 90%, hsl(var(--brand-3) / .12), transparent 55%)",
          }}
        />
        <div className="absolute inset-0 bg-grid opacity-55" />
        <div className="absolute inset-0 noise opacity-55" />
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            data-testid="link-back-home"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>

        <div className="flex items-center gap-2" data-testid="text-preview-label">
          <Badge className="rounded-full" variant="secondary">
            Mobile preview
          </Badge>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 sm:px-6 lg:grid-cols-[1fr_420px]">
        <div className="hidden lg:block">
          <div className="max-w-xl">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Bubble 9 Signup Flow
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Web-based prototype styled like a native iOS/Android app.
            </p>

            <div className="mt-6 grid gap-3">
              {["Welcome", "Account details", "Email verification", "Verified"].map(
                (t, idx) => (
                  <div
                    key={t}
                    className="glass rounded-2xl border px-4 py-3"
                    data-testid={`row-step-${idx}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{t}</div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ),
              )}
            </div>

            <div className="mt-6 glass rounded-2xl border p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground" data-testid="text-note-title">
                Notes
              </div>
              <div className="mt-1" data-testid="text-note-body">
                Tap targets are large, spacing matches mobile rhythm, and transitions
                are animated between screens.
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[420px]">
          <div
            className="relative mx-auto w-full overflow-hidden rounded-[44px] border bg-black/5 p-3 shadow-[0_40px_120px_hsl(var(--foreground)/0.18)] dark:bg-white/5"
            data-testid="phone-frame"
          >
            <div className="absolute left-1/2 top-3 h-6 w-40 -translate-x-1/2 rounded-full bg-black/10 dark:bg-white/10" />
            <div
              className="relative overflow-hidden rounded-[36px] bg-background"
              data-testid="phone-screen"
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GradientButton({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn(
        "relative h-12 w-full rounded-full border-0 text-white shadow-[0_12px_30px_hsl(var(--primary)/0.30)]",
        className,
      )}
      style={{
        background:
          "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--brand-2)))",
      }}
    >
      <span className="relative z-10">{children}</span>
    </Button>
  );
}

function TopBar({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={onBack}
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full text-foreground/70",
            !onBack && "opacity-0 pointer-events-none",
          )}
          data-testid="button-nav-back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div
          className="text-sm font-semibold tracking-tight"
          data-testid="text-screen-title"
        >
          {title}
        </div>
        <div className="h-9 w-9" aria-hidden>
          {right}
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="relative min-h-[760px]">
      <div className="relative h-[520px]">
        <img
          src={mosaicImg}
          alt=""
          className="h-full w-full object-cover"
          data-testid="img-welcome-mosaic"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-56"
          style={{
            background:
              "linear-gradient(to bottom, transparent, hsl(var(--background)) 65%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-white/10" />
      </div>

      <div className="px-6 pb-10">
        <div className="-mt-10">
          <div
            className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-white/70 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-white/10 dark:ring-white/10"
            data-testid="badge-appmark"
          >
            <Sparkles className="h-6 w-6 text-primary" strokeWidth={2.2} />
          </div>
        </div>

        <h1
          className="mt-4 text-center font-display text-3xl font-semibold tracking-tight"
          data-testid="text-welcome-title"
        >
          Bubble
        </h1>
        <p
          className="mx-auto mt-2 max-w-[280px] text-center text-sm leading-relaxed text-muted-foreground"
          data-testid="text-welcome-tagline"
        >
          Connect locally. Create moments. Build lasting community.
        </p>

        <div className="mt-7">
          <GradientButton
            onClick={onContinue}
            data-testid="button-welcome-continue"
          >
            Continue
          </GradientButton>
        </div>

        <div
          className="mt-4 text-center text-xs text-muted-foreground"
          data-testid="text-welcome-login"
        >
          Already have an account?{" "}
          <button
            className="font-medium text-foreground underline underline-offset-4"
            data-testid="button-welcome-login"
          >
            Log in
          </button>
        </div>

        <div className="mt-6 grid gap-2">
          <div
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
            data-testid="row-welcome-security"
          >
            <Shield className="h-4 w-4" />
            <span>Privacy controls built-in</span>
          </div>
          <div
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
            data-testid="row-welcome-email"
          >
            <Mail className="h-4 w-4" />
            <span>Email verification for safety</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  testId,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <div className="grid gap-1.5" data-testid={`field-${testId}`}>
      <div className="text-xs font-medium text-foreground/80" data-testid={`text-label-${testId}`}>
        {label}
      </div>
      {children}
      {hint ? (
        <div className="text-[11px] leading-snug text-muted-foreground" data-testid={`text-hint-${testId}`}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function AccountDetailsScreen({
  value,
  onChange,
  onContinue,
}: {
  value: AccountDetails;
  onChange: (next: AccountDetails) => void;
  onContinue: () => void;
}) {
  const canContinue =
    value.legalName.trim() &&
    value.gender.trim() &&
    value.dob.trim() &&
    value.email.trim();

  return (
    <div
      className="min-h-[760px]"
      style={{
        backgroundImage: `url(${gradientImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <TopBar title="Sign up" onBack={() => {}} />

      <div className="px-5 pb-10">
        <Card className="glass rounded-[28px] border p-0 shadow-none" data-testid="card-signup">
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/60 text-primary dark:bg-white/5">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-lg font-semibold" data-testid="text-details-title">
                  Account details
                </div>
                <div className="text-sm text-muted-foreground" data-testid="text-details-subtitle">
                  Keep the community safe 18+ only.
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <Field
                label="Legal name"
                hint="Make sure this matches the name on your government ID."
                testId="legal-name"
              >
                <Input
                  value={value.legalName}
                  onChange={(e) => onChange({ ...value, legalName: e.target.value })}
                  placeholder="Full name"
                  className="h-12 rounded-2xl bg-white/70"
                  data-testid="input-legal-name"
                />
              </Field>

              <Field label="Gender" testId="gender">
                <select
                  value={value.gender}
                  onChange={(e) => onChange({ ...value, gender: e.target.value })}
                  className="h-12 w-full rounded-2xl border border-input bg-white/70 px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  data-testid="select-gender"
                >
                  <option value="">Please select one</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="nonbinary">Non-binary</option>
                  <option value="prefer-not">Prefer not to say</option>
                </select>
              </Field>

              <Field label="Date of birth" testId="dob">
                <Input
                  type="date"
                  value={value.dob}
                  onChange={(e) => onChange({ ...value, dob: e.target.value })}
                  className="h-12 rounded-2xl bg-white/70"
                  data-testid="input-dob"
                />
              </Field>

              <Field
                label="Email"
                hint="Well email you occasional updates about your communities."
                testId="email"
              >
                <Input
                  type="email"
                  value={value.email}
                  onChange={(e) => onChange({ ...value, email: e.target.value })}
                  placeholder="john.doe@gmail.com"
                  className="h-12 rounded-2xl bg-white/70"
                  data-testid="input-email"
                />
              </Field>

              <div className="pt-1">
                <GradientButton
                  onClick={onContinue}
                  disabled={!canContinue}
                  className="disabled:opacity-60"
                  data-testid="button-details-continue"
                >
                  Continue
                </GradientButton>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmailVerificationScreen({
  filled,
  otp,
  onOTPChange,
  onVerify,
}: {
  filled: boolean;
  otp: string;
  onOTPChange: (v: string) => void;
  onVerify: () => void;
}) {
  const isReady = otp.length === 6;

  return (
    <div
      className="min-h-[760px]"
      style={{
        backgroundImage: `url(${gradientImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <TopBar title="Email Verification" onBack={() => {}} />

      <div className="px-6 pb-10">
        <div className="mx-auto mt-2 max-w-[320px] text-center">
          <p
            className="text-sm leading-relaxed text-muted-foreground"
            data-testid="text-verify-instructions"
          >
            Please enter the 6-digit verification code that was sent to your email.
            The code is valid for 30 minutes.
          </p>
        </div>

        <div className="mt-6 flex justify-center" data-testid="otp-wrapper">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={onOTPChange}
            containerClassName="gap-2"
            data-testid="input-otp"
          >
            <InputOTPGroup className="gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className={cn(
                    "h-12 w-12 rounded-2xl border border-input bg-white/70 text-base shadow-none",
                    filled && "bg-white/85",
                  )}
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="mt-6 px-2">
          <GradientButton
            onClick={onVerify}
            disabled={!isReady}
            className="disabled:opacity-60"
            data-testid="button-verify"
          >
            Verify
          </GradientButton>

          <button
            className="mt-3 w-full rounded-full border border-transparent py-3 text-sm font-medium text-primary"
            data-testid="button-send-new-code"
          >
            Send new code
          </button>
        </div>

        <div
          className="mt-6 text-center text-xs text-muted-foreground"
          data-testid="text-verify-footer"
        >
          Didnt get an email? Check spam or try again.
        </div>
      </div>
    </div>
  );
}

export default function AuthFlow() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [details, setDetails] = useState<AccountDetails>({
    legalName: "",
    gender: "",
    dob: "",
    email: "",
  });
  const [otp, setOtp] = useState("");

  const stepIndex = useMemo(() => screens.indexOf(screen), [screen]);

  return (
    <PhoneFrame>
      <div className="relative">
        <div className="absolute right-4 top-4 z-20 lg:hidden">
          <Badge
            variant="secondary"
            className="rounded-full"
            data-testid="badge-step"
          >
            {stepIndex + 1}/{screens.length}
          </Badge>
        </div>

        <AnimatePresence mode="wait">
          {screen === "welcome" ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <WelcomeScreen onContinue={() => setScreen("details")} />
            </motion.div>
          ) : null}

          {screen === "details" ? (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <div className="absolute left-3 top-3 z-20">
                <button
                  onClick={() => setScreen("welcome")}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-white/10 dark:ring-white/10"
                  data-testid="button-details-back"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>

              <AccountDetailsScreen
                value={details}
                onChange={setDetails}
                onContinue={() => setScreen("verify")}
              />
            </motion.div>
          ) : null}

          {screen === "verify" ? (
            <motion.div
              key="verify"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <div className="absolute left-3 top-3 z-20">
                <button
                  onClick={() => setScreen("details")}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-white/10 dark:ring-white/10"
                  data-testid="button-verify-back"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>

              <EmailVerificationScreen
                filled={false}
                otp={otp}
                onOTPChange={(v) => setOtp(v)}
                onVerify={() => setScreen("verifyFilled")}
              />
            </motion.div>
          ) : null}

          {screen === "verifyFilled" ? (
            <motion.div
              key="verifyFilled"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <div className="absolute left-3 top-3 z-20">
                <button
                  onClick={() => setScreen("verify")}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-white/10 dark:ring-white/10"
                  data-testid="button-verifyfilled-back"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>

              <EmailVerificationScreen
                filled={true}
                otp={"462416"}
                onOTPChange={() => {}}
                onVerify={() => {}}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </PhoneFrame>
  );
}
