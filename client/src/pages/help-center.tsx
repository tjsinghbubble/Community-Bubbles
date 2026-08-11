import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";

const OPEN_ISSUES = [
  { id: "6148", status: "In progress", createdAgo: "59 minutes ago" },
  { id: "6088", status: "In progress", createdAgo: "1 minutes ago" },
];

export default function HelpCenter() {
  const [, navigate] = useLocation();

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 md:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate("/get-help")}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 ring-1 ring-black/5 text-foreground/70 shadow-sm"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-[20px] font-bold tracking-tight">Help Center</h1>
        </div>

        <div className="space-y-5">
          <div>
            <div className="text-[14px] font-semibold" data-testid="text-heading-help">Get help or support</div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              You can report a Bubble or Event concern here. For help with a Bubble, Event, or your account,{" "}
              <button
                className="text-[hsl(var(--primary))] underline underline-offset-2"
                onClick={() => alert("This feature will be available in a future update.")}
                data-testid="link-start-here"
              >
                start here
              </button>
            </p>
          </div>

          <div className="h-px bg-black/10" />

          <div>
            <div className="text-[14px]" data-testid="text-heading-emergency">For emergencies</div>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed" data-testid="text-emergency-body">
              If you feel unsafe or are concerned about your or someone else's well-being, please contact local
              emergency services immediately.
            </p>
          </div>

          <div className="h-px bg-black/10" />

          <div>
            <div className="text-[14px] font-semibold" data-testid="text-heading-events">Urgent Event situations</div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Reach out to Event Admins if there's a issue or disturbance happening nearby.
            </p>
          </div>

          <div className="h-px bg-black/10" />

          <div>
            <button
              className="text-[13px] font-semibold text-[hsl(var(--primary))] underline underline-offset-2"
              onClick={() => {}}
              data-testid="link-open-issues"
            >
              Need help with an issue we're already working on?
            </button>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Select an open issue to add more details or ask for an update.
            </p>

            <div className="mt-4 divide-y divide-black/5 overflow-hidden rounded-2xl bg-white/60 px-5 ring-1 ring-black/5">
              {OPEN_ISSUES.map((issue) => (
                <button
                  key={issue.id}
                  className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
                  onClick={() => alert(`Issue #${issue.id} details will be available in a future update.`)}
                  data-testid={`button-issue-${issue.id}`}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">Issue ending in #{issue.id}</div>
                    <div className="mt-1.5 inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                      {issue.status}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">Created {issue.createdAgo}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate("/report-concern")}
            className="w-full rounded-full bg-[hsl(var(--primary))] py-3.5 text-center text-[14px] font-semibold text-white"
            data-testid="button-report-new-issue"
          >
            Report a new issue
          </button>
        </div>
      </div>
    </AppShell>
  );
}
