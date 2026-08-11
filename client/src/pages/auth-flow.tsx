import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Apple, ChevronLeft, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/queryClient";

const INTEREST_OPTIONS = [
  { id: "hiking", label: "Hiking" },
  { id: "running", label: "Running" },
  { id: "cycling", label: "Cycling" },
  { id: "yoga", label: "Yoga" },
  { id: "fitness", label: "Fitness" },
  { id: "cooking", label: "Cooking" },
  { id: "coffee", label: "Coffee" },
  { id: "dining", label: "Dining Out" },
  { id: "book_clubs", label: "Book Clubs" },
  { id: "photography", label: "Photography" },
  { id: "music", label: "Music" },
  { id: "arts", label: "Arts & Crafts" },
  { id: "gaming", label: "Gaming" },
  { id: "tech", label: "Tech" },
  { id: "travel", label: "Travel" },
  { id: "pets", label: "Pets" },
  { id: "wellness", label: "Wellness" },
  { id: "volunteering", label: "Volunteering" },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Stage = "welcome" | "login" | "signup";
type SignupStep = "details" | "interests";

// Exact paths from mobile/src/components/icons/BubbleLogoIcon.tsx — keep in sync.
function BubbleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 73 67" fill="none" className={className} aria-hidden="true">
      <path d="M51.5265 2C46.3601 2.00311 41.4063 4.07912 37.7524 7.76734C34.1017 11.4587 32.0468 16.4634 32.0437 21.6831C33.1158 47.8271 69.9371 47.8271 71.0089 21.6831C71.0058 16.4636 68.9509 11.4588 65.3002 7.76734C61.6464 4.07912 56.6931 2.00311 51.5265 2ZM51.5265 38.8758C47.0132 38.8727 42.6879 37.0613 39.4961 33.8368C36.3043 30.6123 34.5115 26.2426 34.5084 21.6827C35.4449 -1.12513 67.6082 -1.12513 68.5443 21.6827C68.5382 26.2394 66.7421 30.6091 63.5535 33.8337C60.3619 37.055 56.0368 38.8696 51.5265 38.8758Z" fill="currentColor" stroke="currentColor" strokeWidth="4" />
      <path d="M51.5261 9.95525C50.2939 9.95525 48.1004 9.85565 48.3223 11.6235C48.3839 11.9503 48.5749 12.2366 48.846 12.4202C49.1202 12.607 49.4529 12.6723 49.7763 12.607C53.0049 11.9907 56.3135 13.1641 58.4483 15.6882C60.5831 18.2092 61.2178 21.695 60.1149 24.8198C59.9732 25.2026 60.0256 25.6321 60.2566 25.9682C60.4877 26.3013 60.8697 26.5004 61.2733 26.5004C61.7908 26.5004 62.256 26.1705 62.4317 25.6788C63.7286 22.081 63.208 18.0692 61.0392 14.929C58.8674 11.7887 55.3185 9.91505 51.5266 9.90573L51.5261 9.95525Z" fill="currentColor" stroke="currentColor" strokeWidth="4" />
      <path d="M16.1098 23.4006C12.3699 23.4068 8.78397 24.9101 6.14051 27.5836C3.49421 30.254 2.00627 33.8767 2.00012 37.6553C2.77645 56.5655 29.4426 56.5655 30.2186 37.6553C30.2125 33.877 28.7246 30.2542 26.0783 27.5836C23.435 24.9101 19.8492 23.4068 16.109 23.4006H16.1098ZM16.1098 49.4194C13.0229 49.4163 10.0624 48.1745 7.8779 45.971C5.69682 43.7644 4.46764 40.7734 4.46456 37.6545C5.09302 22.0556 27.1255 22.0684 27.7541 37.6545C27.751 40.773 26.5218 43.764 24.3407 45.971C22.1566 48.1745 19.1961 49.4163 16.1088 49.4194H16.1098Z" fill="currentColor" stroke="currentColor" strokeWidth="4" />
      <path d="M13.6085 29.7264C10.1828 30.8157 7.85693 34.0276 7.86624 37.6565C7.86624 38.7272 7.86624 40.5199 9.28336 40.5448C9.66536 40.5541 10.032 40.386 10.2722 40.0841C10.5125 39.7854 10.605 39.3901 10.5156 39.0135C10.4078 38.5684 10.3523 38.114 10.3554 37.6565C10.34 35.1293 11.945 32.8853 14.3233 32.1041C14.9332 31.8738 15.2598 31.2046 15.0718 30.5759C14.8839 29.9472 14.2431 29.5739 13.6085 29.7264Z" fill="currentColor" stroke="currentColor" strokeWidth="4" />
      <path d="M35.5252 51.2282C34.2814 51.8491 33.5987 52.912 33.8396 53.8523C33.9096 54.13 34.0269 54.595 34.5725 54.4614C34.7197 54.4261 34.8494 54.3463 34.9219 54.2443C34.9946 54.143 35.0043 54.0314 34.9453 53.9425C34.8748 53.8377 34.8238 53.7254 34.7951 53.6064C34.6239 52.9524 35.0932 52.2118 35.955 51.7743C36.1741 51.6543 36.2557 51.4485 36.1425 51.304C36.0292 51.1595 35.7588 51.1259 35.5252 51.2282Z" fill="currentColor" stroke="currentColor" strokeWidth="4" />
      <path d="M39.4618 44.6392C33.8797 44.6455 29.3577 49.2206 29.3577 54.86C29.8629 68.3801 49.0738 68.3801 49.5793 54.86C49.5732 49.2174 45.0469 44.6456 39.4618 44.6392ZM39.4618 62.579C35.2444 62.5727 31.8279 59.1212 31.8218 54.8604C32.1791 44.6396 46.7572 44.6396 47.1144 54.8604C47.1083 59.1243 43.6822 62.579 39.4618 62.579Z" fill="currentColor" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

function GoogleG({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center justify-center rounded-full border bg-white", className)}>
      <span className="text-[11px] font-bold leading-none text-[#4285F4]">G</span>
    </span>
  );
}

export default function AuthFlow() {
  const search = useSearch();
  const [stage, setStage] = useState<Stage>(() => {
    const t = new URLSearchParams(search).get("tab");
    return t === "signup" || t === "login" ? t : "welcome";
  });
  const [signupStep, setSignupStep] = useState<SignupStep>("details");
  const [, navigate] = useLocation();
  const { login, signup, user, isLoading } = useAuth();

  // Already authenticated? Don't show another login page — go to the app.
  // Wait for the auth context to finish restoring localStorage state so we
  // don't redirect (or fail to) based on a not-yet-loaded session.
  useEffect(() => {
    if (!isLoading && user) {
      navigate("/explore", { replace: true });
    }
  }, [isLoading, user, navigate]);

  const [welcomeEmail, setWelcomeEmail] = useState(
    () => new URLSearchParams(search).get("email") ?? "",
  );
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [welcomeError, setWelcomeError] = useState("");
  const [socialNotice, setSocialNotice] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState(() => {
    // Handed off from the marketing homepage with ?tab=signup&email=... —
    // prefill directly so the signup form shows immediately.
    const params = new URLSearchParams(search);
    return params.get("tab") === "signup" ? (params.get("email") ?? "") : "";
  });
  const [signupPassword, setSignupPassword] = useState("");
  const [signupInterests, setSignupInterests] = useState<string[]>([]);
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);

  const isWelcomeEmailValid = EMAIL_REGEX.test(welcomeEmail.trim());

  const checkEmailAndRoute = async (trimmed: string) => {
    if (!EMAIL_REGEX.test(trimmed)) return;
    setWelcomeError("");
    setCheckingEmail(true);
    try {
      const res = await apiRequest("POST", "/api/auth/check-email", { email: trimmed });
      const data = await res.json();
      if (data.exists) {
        setLoginEmail(trimmed);
        setLoginError("");
        setStage("login");
      } else {
        setSignupEmail(trimmed);
        setSignupStep("details");
        setSignupError("");
        setStage("signup");
      }
    } catch (err: any) {
      setWelcomeError(err.message || "Something went wrong. Please try again.");
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleContinueWelcome = (e: React.FormEvent) => {
    e.preventDefault();
    checkEmailAndRoute(welcomeEmail.trim());
  };

  // A prefilled ?email= (e.g. handed off from the marketing homepage's preview
  // card) auto-continues once, so the user isn't asked to click Continue twice.
  // When an explicit ?tab= is set the sender already routed the user (e.g. the
  // homepage checked the email and chose signup) — don't re-check.
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("tab")) return;
    const prefilled = params.get("email");
    if (prefilled && EMAIL_REGEX.test(prefilled.trim())) {
      checkEmailAndRoute(prefilled.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSocialClick = (provider: "Google" | "Apple") => {
    setSocialNotice(`${provider} sign-in isn't set up on web yet — continue with email above, or use the mobile app.`);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      navigate("/explore");
    } catch (err: any) {
      setLoginError(err.message || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignupDetails = (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    if (!signupName.trim()) return setSignupError("Please enter your name");
    if (!signupEmail.trim()) return setSignupError("Please enter your email");
    if (signupPassword.length < 6) return setSignupError("Password must be at least 6 characters");
    setSignupStep("interests");
  };

  const handleSignupFinish = async () => {
    if (signupInterests.length === 0) return setSignupError("Pick at least one interest");
    setSignupError("");
    setSignupLoading(true);
    try {
      await signup({ name: signupName, email: signupEmail, password: signupPassword, interests: signupInterests });
      navigate("/explore");
    } catch (err: any) {
      setSignupError(err.message || "Sign up failed");
      setSignupStep("details");
    } finally {
      setSignupLoading(false);
    }
  };

  const toggleInterest = (id: string) =>
    setSignupInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );

  const backToWelcome = () => {
    setStage("welcome");
    setLoginError("");
    setSignupError("");
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-12 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24">
        <div className="text-center lg:text-left">
          <Link href="/" className="inline-flex items-center gap-3 text-primary" data-testid="link-logo-home">
            <BubbleLogo className="h-9 w-9 lg:h-12 lg:w-12" />
            <span className="text-4xl font-bold tracking-tight text-foreground lg:text-6xl">Bubble</span>
          </Link>
          <p className="mx-auto mt-4 max-w-sm text-lg text-muted-foreground lg:mx-0 lg:mt-6 lg:text-xl">
            Connect locally. Build lasting community.
          </p>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border bg-card p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {stage === "welcome" ? (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <h1 className="mb-5 text-xl font-bold" data-testid="text-auth-heading">
                    Log in or sign up
                  </h1>
                  <form onSubmit={handleContinueWelcome} className="space-y-4">
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={welcomeEmail}
                      onChange={(e) => setWelcomeEmail(e.target.value)}
                      className="h-14 rounded-[8px] text-base"
                      data-testid="input-welcome-email"
                    />
                    {welcomeError && (
                      <p className="text-sm text-destructive" data-testid="text-welcome-error">
                        {welcomeError}
                      </p>
                    )}
                    <Button
                      type="submit"
                      disabled={!isWelcomeEmailValid || checkingEmail}
                      className="h-14 w-full rounded-full bg-gradient-to-br from-primary via-primary to-brand-2 text-base font-bold shadow-none hover:opacity-90 disabled:opacity-100 disabled:bg-none disabled:bg-muted disabled:text-muted-foreground"
                      data-testid="button-welcome-continue"
                    >
                      {checkingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                    </Button>

                    <div className="flex items-center gap-3 py-1" aria-hidden="true">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-sm text-muted-foreground">or</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSocialClick("Google")}
                      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[8px] border text-sm font-medium hover:bg-muted"
                      data-testid="button-google-signin"
                    >
                      <GoogleG className="h-[22px] w-[22px]" />
                      Continue with Google
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSocialClick("Apple")}
                      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[8px] border text-sm font-medium hover:bg-muted"
                      data-testid="button-apple-signin"
                    >
                      <Apple className="h-[22px] w-[22px]" fill="currentColor" />
                      Continue with Apple
                    </button>
                    {socialNotice && (
                      <p className="text-center text-xs text-muted-foreground" data-testid="text-social-notice">
                        {socialNotice}
                      </p>
                    )}
                  </form>
                </motion.div>
              ) : stage === "login" ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="mb-5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={backToWelcome}
                      className="flex h-8 w-8 items-center justify-center -ml-2 text-foreground"
                      data-testid="button-back-to-welcome"
                      aria-label="Back"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h1 className="text-xl font-bold" data-testid="text-auth-heading">
                      Welcome back!
                    </h1>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-base font-medium">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        className="h-14 rounded-[8px] text-base"
                        data-testid="input-login-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-base font-medium">Password</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showLoginPw ? "text" : "password"}
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          className="h-14 rounded-[8px] pr-12 text-base"
                          data-testid="input-login-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                          data-testid="button-toggle-password"
                        >
                          {showLoginPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    {loginError && (
                      <p className="text-sm text-destructive" data-testid="text-login-error">
                        {loginError}
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="h-14 w-full rounded-full bg-gradient-to-br from-primary via-primary to-brand-2 text-base font-bold shadow-none hover:opacity-90"
                      disabled={loginLoading}
                      data-testid="button-login-submit"
                    >
                      {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                    </Button>
                    <p className="pt-2 text-center text-xs text-muted-foreground">
                      Test account: george@seinfeld.com / Bubble123!
                    </p>
                  </form>
                </motion.div>
              ) : signupStep === "details" ? (
                <motion.div
                  key="signup-details"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="mb-5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={backToWelcome}
                      className="flex h-8 w-8 items-center justify-center -ml-2 text-foreground"
                      data-testid="button-back-to-welcome"
                      aria-label="Back"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h1 className="text-xl font-bold" data-testid="text-auth-heading">
                      Create your account
                    </h1>
                  </div>
                  <form onSubmit={handleSignupDetails} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-base font-medium">Full Name</Label>
                      <Input
                        id="signup-name"
                        placeholder="Your name"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                        className="h-14 rounded-[8px] text-base"
                        data-testid="input-signup-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-base font-medium">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        className="h-14 rounded-[8px] text-base"
                        data-testid="input-signup-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-base font-medium">Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showSignupPw ? "text" : "password"}
                          placeholder="At least 6 characters"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          required
                          className="h-14 rounded-[8px] pr-12 text-base"
                          data-testid="input-signup-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showSignupPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    {signupError && (
                      <p className="text-sm text-destructive" data-testid="text-signup-error">
                        {signupError}
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="h-14 w-full rounded-full bg-gradient-to-br from-primary via-primary to-brand-2 text-base font-bold shadow-none hover:opacity-90"
                      data-testid="button-signup-next"
                    >
                      Continue
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="signup-interests"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <div>
                    <p className="text-sm font-medium">What are you into?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Pick as many as you like — we'll find bubbles you'll love.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => toggleInterest(opt.id)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                          signupInterests.includes(opt.id)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                        )}
                        data-testid={`chip-interest-${opt.id}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {signupError && (
                    <p className="text-sm text-destructive" data-testid="text-signup-error-interests">
                      {signupError}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="h-14 flex-1 rounded-full text-base font-bold"
                      onClick={() => { setSignupStep("details"); setSignupError(""); }}
                      data-testid="button-signup-back"
                    >
                      Back
                    </Button>
                    <Button
                      className="h-14 flex-1 rounded-full bg-gradient-to-br from-primary via-primary to-brand-2 text-base font-bold shadow-none hover:opacity-90"
                      onClick={handleSignupFinish}
                      disabled={signupLoading}
                      data-testid="button-signup-submit"
                    >
                      {signupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Bubble"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {stage === "welcome" && (
            <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
              By continuing, you agree to our{" "}
              <Link href="/legal/terms" className="text-primary underline underline-offset-2">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="text-primary underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
