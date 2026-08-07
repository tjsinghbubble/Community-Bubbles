import { useLocation } from "wouter";
import { ArrowLeft, Bug, ChevronRight, Flag, Lightbulb, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";

function MenuRow({
  icon: Icon,
  label,
  onClick,
  testId,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-black/5"
    >
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 text-[13px] font-semibold">{label}</div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export default function GetHelp() {
  const [, navigate] = useLocation();

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
          <h1 className="font-display text-[20px] font-bold tracking-tight">Get Help</h1>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white/60 ring-1 ring-black/5 divide-y divide-black/5">
          <MenuRow
            icon={Flag}
            label="Report a Bubble or Concern"
            onClick={() => navigate("/help-center")}
            testId="button-help-center"
          />
          <MenuRow
            icon={MessageCircle}
            label="Give us Feedback"
            onClick={() => navigate("/give-feedback")}
            testId="button-give-feedback"
          />
          <MenuRow
            icon={Lightbulb}
            label="Request a Feature"
            onClick={() => navigate("/feature-request")}
            testId="button-feature-request"
          />
          <MenuRow
            icon={Bug}
            label="Report a Bug"
            onClick={() => navigate("/defect-report")}
            testId="button-defect-report"
          />
        </div>
      </div>
    </AppShell>
  );
}
