import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

export default function ProfileEdit() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
  });

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  const displayName = name || me?.name || "";
  const displayBio = bio || me?.bio || "";

  const initials = (me?.name || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", "/api/auth/me", {
        name: name || me?.name,
        bio: bio || me?.bio,
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/profile");
    },
  });

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
          <h1 className="font-display text-[20px] font-bold tracking-tight">Edit Profile</h1>
        </div>

        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/60 p-6 ring-1 ring-black/5">
            <div
              className="relative grid h-20 w-20 place-items-center rounded-full text-[26px] font-bold text-white shadow"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
            >
              {initials}
              <button
                className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-white shadow ring-1 ring-black/10 text-foreground"
                data-testid="button-change-photo"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <span className="text-[12px] text-muted-foreground">Tap to change photo</span>
          </div>

          <div className="space-y-4 rounded-2xl bg-white/60 p-5 ring-1 ring-black/5">
            <div>
              <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                Full Name
              </label>
              <input
                value={name || me?.name || ""}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-[14px] outline-none ring-0 transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                data-testid="input-name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                Bio
              </label>
              <textarea
                value={bio || me?.bio || ""}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell your community a little about yourself…"
                rows={3}
                className="w-full resize-none rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-[14px] outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                data-testid="input-bio"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                Email
              </label>
              <input
                value={me?.email || ""}
                disabled
                className="w-full rounded-xl border border-black/5 bg-black/5 px-4 py-3 text-[14px] text-muted-foreground"
                data-testid="input-email"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Email cannot be changed here.</p>
            </div>
          </div>

          <button
            onClick={() => save()}
            disabled={isPending}
            className="w-full rounded-2xl py-4 text-[15px] font-bold text-white shadow disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
            data-testid="button-save"
          >
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
