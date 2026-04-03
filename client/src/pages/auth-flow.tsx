import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

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

type Tab = "login" | "signup";
type SignupStep = "details" | "interests";

export default function AuthFlow() {
  const [tab, setTab] = useState<Tab>("login");
  const [signupStep, setSignupStep] = useState<SignupStep>("details");
  const [, navigate] = useLocation();
  const { login, signup } = useAuth();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupInterests, setSignupInterests] = useState<string[]>([]);
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);

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

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
      >
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

      <div className="mx-auto flex max-w-6xl items-center px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          data-testid="link-back-home"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 pb-16 pt-8 sm:px-6 lg:flex-row lg:items-start lg:gap-20 lg:pt-16">
        <div className="hidden max-w-sm lg:block">
          <div
            className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            data-testid="badge-tagline"
          >
            🫧 Local communities, real connections
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Find your people,<br />find your Bubble.
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Join interest-based groups in your area. Discover events, chat with members, and build friendships that last.
          </p>
          <div className="mt-8 grid gap-3 text-sm">
            {[
              ["🏃", "Active communities — hiking, running, tennis & more"],
              ["🎨", "Creative groups — photography, music, arts"],
              ["☕", "Social scenes — coffee, brunch, book clubs"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-start gap-3">
                <span className="text-lg leading-none">{icon}</span>
                <span className="text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="rounded-3xl border bg-background/80 p-8 shadow-xl backdrop-blur-sm">
            <div className="mb-6 flex gap-1 rounded-2xl bg-muted p-1">
              {(["login", "signup"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setSignupStep("details"); setLoginError(""); setSignupError(""); }}
                  className={cn(
                    "flex-1 rounded-xl py-2 text-sm font-medium transition-all",
                    tab === t
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`tab-${t}`}
                >
                  {t === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === "login" ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  onSubmit={handleLogin}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="h-11 rounded-xl"
                      data-testid="input-login-email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPw ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="h-11 rounded-xl pr-10"
                        data-testid="input-login-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                        data-testid="button-toggle-password"
                      >
                        {showLoginPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    className="h-11 w-full rounded-xl"
                    disabled={loginLoading}
                    data-testid="button-login-submit"
                  >
                    {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Test account: george@seinfeld.com / Bubble123!
                  </p>
                </motion.form>
              ) : signupStep === "details" ? (
                <motion.form
                  key="signup-details"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  onSubmit={handleSignupDetails}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      placeholder="Your name"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      required
                      className="h-11 rounded-xl"
                      data-testid="input-signup-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      className="h-11 rounded-xl"
                      data-testid="input-signup-email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showSignupPw ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        className="h-11 rounded-xl pr-10"
                        data-testid="input-signup-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showSignupPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    className="h-11 w-full rounded-xl"
                    data-testid="button-signup-next"
                  >
                    Continue
                  </Button>
                </motion.form>
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
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="h-11 flex-1 rounded-xl"
                      onClick={() => { setSignupStep("details"); setSignupError(""); }}
                      data-testid="button-signup-back"
                    >
                      Back
                    </Button>
                    <Button
                      className="h-11 flex-1 rounded-xl"
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
        </div>
      </div>
    </div>
  );
}
