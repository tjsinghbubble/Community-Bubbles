import { useLocation, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";

const CONTENT: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: "Terms of Service",
    body: [
      "Welcome to Bubble. By using our platform you agree to these terms.",
      "1. Eligibility. You must be 18 or older to use Bubble.",
      "2. Account. You are responsible for maintaining the security of your account credentials.",
      "3. Conduct. You agree not to harass, abuse, or harm other members. Bubble reserves the right to remove content and suspend accounts that violate community standards.",
      "4. Content. You retain ownership of content you post, but grant Bubble a non-exclusive license to display it on the platform.",
      "5. Privacy. Your use of Bubble is also governed by our Privacy Policy.",
      "6. Modifications. We may update these terms at any time. Continued use constitutes acceptance.",
      "7. Termination. Bubble may terminate or suspend your account for violations of these terms.",
      "8. Limitation of Liability. Bubble is provided 'as is' and we make no warranties, express or implied.",
      "9. Governing Law. These terms are governed by the laws of the State of California.",
      "If you have questions, contact us at legal@trybubble.io.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    body: [
      "Bubble is committed to protecting your personal information. This policy explains what we collect and how we use it.",
      "Information We Collect. We collect information you provide (name, email, photo, interests) and usage data (pages viewed, features used).",
      "How We Use It. We use your information to operate the platform, personalize your experience, send notifications, and improve our service.",
      "Sharing. We do not sell your personal data. We may share it with service providers (e.g. cloud hosting) under strict data processing agreements.",
      "Retention. We retain your data while your account is active and for a reasonable period after deletion to comply with legal obligations.",
      "Your Rights. You may access, correct, or delete your personal data at any time from your account settings.",
      "Cookies. We use essential cookies to keep you logged in and preference cookies to remember your settings.",
      "Contact. For privacy questions, email privacy@trybubble.io.",
    ],
  },
  community: {
    title: "Community Guidelines",
    body: [
      "Bubble is built on trust, kindness, and local connection. These guidelines help keep it that way.",
      "Be Respectful. Treat every member with courtesy regardless of background, identity, or opinion.",
      "Stay On Topic. Keep discussions relevant to the bubble's purpose so everyone gets value.",
      "No Hate Speech. Content that demeans people based on race, gender, sexuality, religion, or disability is prohibited.",
      "No Spam. Do not post repetitive content, unsolicited promotions, or irrelevant links.",
      "Protect Privacy. Do not share other members' personal information without their explicit consent.",
      "No Illegal Activity. Do not use Bubble to organise or promote illegal activities.",
      "Report Issues. Use the report button to flag content that violates these guidelines. Our team reviews every report.",
      "Enforcement. Violations may result in content removal, temporary suspension, or permanent account termination depending on severity.",
      "Questions? Reach out at community@trybubble.io.",
    ],
  },
};

export default function Legal() {
  const params = useParams<{ page: string }>();
  const [, navigate] = useLocation();
  const page = params.page as keyof typeof CONTENT;
  const content = CONTENT[page];

  if (!content) {
    return (
      <AppShell active="profile">
        <div className="mx-auto w-full max-w-2xl px-4 pt-10 text-center text-muted-foreground">
          Page not found.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 md:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 ring-1 ring-black/5 text-foreground/70 shadow-sm"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-[20px] font-bold tracking-tight">{content.title}</h1>
        </div>

        <div className="rounded-2xl bg-white/60 p-6 ring-1 ring-black/5">
          <div className="space-y-4">
            {content.body.map((para, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-foreground/80">
                {para}
              </p>
            ))}
          </div>
          <div className="mt-6 border-t border-black/5 pt-4 text-[11px] text-muted-foreground">
            Last updated: April 2026
          </div>
        </div>
      </div>
    </AppShell>
  );
}
