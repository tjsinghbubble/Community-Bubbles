import { useRef } from "react";

const LENGTH = 6;

export function CodeInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (raw: string, index: number) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      const next = [...value];
      next[index] = "";
      onChange(next);
      return;
    }
    const next = [...value];
    digits.split("").forEach((d, i) => {
      if (index + i < LENGTH) next[index + i] = d;
    });
    onChange(next);
    const lastFilled = Math.min(index + digits.length - 1, LENGTH - 1);
    inputRefs.current[lastFilled]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2" data-testid="code-input">
      {Array.from({ length: LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(e.target.value, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          disabled={disabled}
          inputMode="numeric"
          maxLength={1}
          className="h-14 w-11 rounded-xl border text-center text-[20px] font-semibold outline-none transition-colors focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
          style={{
            borderColor: value[i] ? "hsl(var(--primary))" : "rgba(0,0,0,0.12)",
            background: value[i] ? "white" : "#F5F6F8",
          }}
          data-testid={`input-code-${i}`}
        />
      ))}
    </div>
  );
}

export function emptyCode(): string[] {
  return Array(LENGTH).fill("");
}

export function codeIsComplete(code: string[]): boolean {
  return code.length === LENGTH && code.every((d) => d !== "");
}
