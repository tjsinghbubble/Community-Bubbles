import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, ImagePlus, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { useUpload } from "@/hooks/use-upload";
import { toast } from "@/hooks/use-toast";
import { CameraCapture } from "@/components/CameraCapture";
import { INTEREST_OPTIONS } from "@/lib/interests";

export default function ProfileEdit() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { uploadFile, isUploading } = useUpload();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
  });

  const [name, setName] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<{ objectPath: string; previewUrl: string } | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (me?.interests && selectedInterests === null) {
      setSelectedInterests(new Set(me.interests));
    }
  }, [me, selectedInterests]);

  const toggleInterest = (key: string) => {
    setSelectedInterests((prev) => {
      const next = new Set<string>(prev ?? me?.interests ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const displayPhoto = pendingPhoto?.previewUrl || me?.profilePhoto || "";

  const initials = (me?.name || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", "/api/users/me", {
        name: name || me?.name,
        aboutMe: aboutMe || me?.aboutMe,
        interests: Array.from(selectedInterests ?? me?.interests ?? []),
        ...(pendingPhoto ? { profilePhoto: pendingPhoto.objectPath } : {}),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/profile");
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Couldn't save", description: err.message || "Please try again." });
    },
  });

  const uploadPhoto = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const uploaded = await uploadFile(file);
    if (!uploaded) {
      toast({ variant: "destructive", title: "Couldn't upload photo", description: "Please try again." });
      return;
    }
    setPendingPhoto({ objectPath: uploaded.objectPath, previewUrl });
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadPhoto(file);
  };

  const handleCapture = async (file: File) => {
    setCameraOpen(false);
    await uploadPhoto(file);
  };

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
              className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-full text-[26px] font-bold text-white shadow"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
            >
              {displayPhoto ? (
                <img src={displayPhoto} alt="" className="h-full w-full object-cover" data-testid="img-profile-photo-preview" />
              ) : (
                initials
              )}
              <button
                onClick={() => setCameraOpen(true)}
                disabled={isUploading}
                className="absolute bottom-0 left-0 grid h-7 w-7 place-items-center rounded-full bg-white shadow ring-1 ring-black/10 text-foreground disabled:opacity-60"
                data-testid="button-take-photo"
                type="button"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-white shadow ring-1 ring-black/10 text-foreground disabled:opacity-60"
                data-testid="button-change-photo"
                type="button"
              >
                {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
                data-testid="input-profile-photo-file"
              />
            </div>
            <span className="text-[12px] text-muted-foreground">
              {isUploading ? "Uploading…" : "Take a photo or choose one from your device"}
            </span>
          </div>

          <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={handleCapture} />

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
                value={aboutMe || me?.aboutMe || ""}
                onChange={(e) => setAboutMe(e.target.value)}
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

          <div className="rounded-2xl bg-white/60 p-5 ring-1 ring-black/5">
            <label className="mb-3 block text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
              Interests
            </label>
            <div className="flex flex-wrap gap-2" data-testid="list-edit-interests">
              {INTEREST_OPTIONS.map(([key, label]) => {
                const active = (selectedInterests ?? new Set(me?.interests ?? [])).has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleInterest(key)}
                    className={
                      active
                        ? "rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
                        : "rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-foreground/70"
                    }
                    style={active ? { background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" } : undefined}
                    data-testid={`chip-interest-${key}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => save()}
            disabled={isPending || isUploading}
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
