import { ArrowLeft } from "lucide-react";

export function AuthCard({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white/70 p-6 shadow-sm ring-1 ring-black/5">
        {onBack ? (
          <button
            onClick={onBack}
            className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-black/5 text-foreground/70"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <h1 className="font-display text-[22px] font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p> : null}
        <div className="mt-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}
