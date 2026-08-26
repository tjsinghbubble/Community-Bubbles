import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, Loader2, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useUpload } from "@/hooks/use-upload";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

const PRIVACY_OPTIONS = [
  { value: "Public", label: "Public", desc: "Anyone can discover and join" },
  { value: "Request", label: "Request to Join", desc: "Admin approval required before joining" },
  { value: "Private", label: "Private", desc: "Invite-only" },
];

export default function EditBubble() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { uploadFile, isUploading } = useUpload();
  const coverRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState("Public");
  const [memberLimit, setMemberLimit] = useState("");
  const [locationName, setLocationName] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<{ url: string; file?: File }[]>([]);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      try {
        const [bubbleRes, membershipRes] = await Promise.all([
          fetch(`/api/bubbles/${id}`),
          apiRequest("GET", `/api/bubbles/${id}/membership`),
        ]);
        const bubble = await bubbleRes.json();
        const membership = await membershipRes.json();

        if (!bubbleRes.ok || bubble.error) {
          setLoadError(bubble.error || "Bubble not found");
          return;
        }
        if (membership.role !== "admin" && !user.isSuperAdmin) {
          setNotAuthorized(true);
          return;
        }

        setTitle(bubble.title ?? "");
        setTagline(bubble.tagline ?? "");
        setDescription(bubble.description ?? "");
        setPrivacy(bubble.privacy ?? "Public");
        setMemberLimit(bubble.memberLimit ? String(bubble.memberLimit) : "");
        setLocationName(bubble.locationName ?? "");
        const existingCover = bubble.coverImage || (bubble.images && bubble.images[0]) || null;
        setCoverImage(existingCover);
        setCoverPreview(existingCover ?? "");
        setAttachments(
          Array.isArray(bubble.attachments) ? bubble.attachments.map((url: string) => ({ url })) : [],
        );
      } catch (err: any) {
        setLoadError(err.message || "Failed to load bubble");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user]);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const handleAttachmentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setAttachments((prev) => [...prev, ...files.map((file) => ({ url: URL.createObjectURL(file), file }))]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      setSaveError("Title and description are required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      let nextCoverImage = coverImage;
      if (coverFile) {
        const uploaded = await uploadFile(coverFile);
        if (!uploaded) {
          setSaveError("Failed to upload cover photo. Please try again.");
          setSaving(false);
          return;
        }
        nextCoverImage = uploaded.objectPath;
      }

      const nextAttachments: string[] = [];
      for (const a of attachments) {
        if (!a.file) {
          nextAttachments.push(a.url);
          continue;
        }
        const uploaded = await uploadFile(a.file);
        if (!uploaded) {
          setSaveError("Failed to upload an attachment. Please try again.");
          setSaving(false);
          return;
        }
        nextAttachments.push(uploaded.objectPath);
      }

      const memberLimitNum = memberLimit && !isNaN(parseInt(memberLimit)) ? parseInt(memberLimit) : null;

      const res = await apiRequest("PUT", `/api/bubbles/${id}`, {
        title: title.trim(),
        tagline: tagline.trim() || title.trim(),
        description: description.trim(),
        privacy,
        memberLimit: memberLimitNum,
        locationName: locationName.trim() || null,
        coverImage: nextCoverImage,
        images: nextCoverImage ? [nextCoverImage] : [],
        attachments: nextAttachments,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || "Failed to save changes");
        setSaving(false);
        return;
      }

      await qc.invalidateQueries({ queryKey: [`/api/bubbles/${id}`] });
      toast({ title: "Bubble updated" });
      navigate(`/bubble/${id}`);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background" data-testid="loading-edit-bubble">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center" data-testid="error-edit-bubble">
        <div className="text-sm text-muted-foreground">{loadError}</div>
      </div>
    );
  }

  if (notAuthorized) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center" data-testid="not-authorized-edit-bubble">
        <div className="text-sm font-semibold">Only bubble admins can edit this bubble.</div>
        <Button variant="outline" onClick={() => navigate(`/bubble/${id}`)}>Back to Bubble</Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/85 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => navigate(`/bubble/${id}`)}
          className="flex h-10 w-10 items-center justify-center rounded-full"
          data-testid="button-edit-bubble-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-[16px] font-bold" data-testid="text-edit-bubble-title">Edit Bubble</span>
        <div className="h-10 w-10" aria-hidden />
      </div>

      <div className="mx-auto w-full max-w-md space-y-5 px-5 py-6">
        <div>
          <Label className="mb-2 block text-sm font-medium">Cover Photo</Label>
          <button
            onClick={() => coverRef.current?.click()}
            className="group relative w-full overflow-hidden rounded-xl border border-dashed border-border hover:border-primary"
            data-testid="button-edit-cover-upload"
            type="button"
          >
            {coverPreview ? (
              <img src={coverPreview} alt="" className="h-40 w-full object-cover" data-testid="img-edit-cover-preview" />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-2">
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground">+ Add cover photo</span>
              </div>
            )}
          </button>
          <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} data-testid="input-edit-cover-file" />
        </div>

        <div>
          <Label className="mb-2 block text-sm font-medium">Attachments</Label>
          <div className="grid grid-cols-3 gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-black/10">
                <img src={a.url} alt="" className="h-full w-full object-cover" data-testid={`img-edit-attachment-${i}`} />
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                  data-testid={`button-remove-attachment-${i}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => attachmentsRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border hover:border-primary"
              data-testid="button-add-attachment"
            >
              <Paperclip className="h-5 w-5 text-muted-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground">Add</span>
            </button>
          </div>
          <input
            ref={attachmentsRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleAttachmentsChange}
            data-testid="input-edit-attachments-file"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-title">Title</Label>
          <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} data-testid="input-edit-title" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-tagline">Tagline</Label>
          <Input id="edit-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={100} data-testid="input-edit-tagline" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={500} data-testid="input-edit-description" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-location">Location</Label>
          <Input id="edit-location" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g. San Francisco, CA" data-testid="input-edit-location" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-member-limit">Member limit (optional)</Label>
          <Input id="edit-member-limit" type="number" min={1} value={memberLimit} onChange={(e) => setMemberLimit(e.target.value)} data-testid="input-edit-member-limit" />
        </div>

        <div className="space-y-2">
          <Label>Privacy</Label>
          <div className="space-y-2">
            {PRIVACY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPrivacy(opt.value)}
                className={`w-full rounded-xl border px-4 py-3 text-left ${privacy === opt.value ? "border-primary bg-primary/5" : "border-border"}`}
                data-testid={`option-edit-privacy-${opt.value.toLowerCase()}`}
              >
                <div className="text-sm font-semibold">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {saveError && (
          <p className="text-sm text-destructive" data-testid="text-edit-bubble-error">{saveError}</p>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || isUploading}
          className="h-12 w-full rounded-full text-base font-semibold"
          data-testid="button-save-edit-bubble"
        >
          {saving || isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
