import { useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Type,
  AlignLeft,
  Users,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ImagePlus,
  Repeat,
  CalendarClock,
  PawPrint,
  CigaretteOff,
  Accessibility,
  GraduationCap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { useUpload } from "@/hooks/use-upload";
import { CameraCapture, TakePhotoButton } from "@/components/CameraCapture";
import { cn } from "@/lib/utils";

const RECURRENCE_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "daily", label: "Every Day" },
  { value: "weekly", label: "Every Week" },
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Every Month" },
  { value: "yearly", label: "Every Year" },
  { value: "custom", label: "Custom" },
] as const;

const CUSTOM_FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

const AMENITIES = [
  { key: "petFriendly", label: "Pet Friendly", icon: PawPrint },
  { key: "smokeFree", label: "Smoke Free", icon: CigaretteOff },
  { key: "wheelchairAccessible", label: "Accessible", icon: Accessibility },
] as const;

const BLUE = "#35A8F7";
const BG = "#FAFAFA";
const CARD_BG = "#FFFFFF";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[13px] font-semibold text-black/70">{children}</div>
  );
}

function FieldWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl bg-white px-4"
      style={{
        height: 52,
        border: "1px solid rgba(0,0,0,0.10)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {children}
    </div>
  );
}

function TextAreaWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl bg-white px-4 py-3"
      style={{
        border: "1px solid rgba(0,0,0,0.10)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {children}
    </div>
  );
}

function IconWrap({ icon: Icon }: { icon: React.ElementType }) {
  return <Icon className="h-4 w-4 shrink-0 text-black/35" />;
}

export default function CreateEvent() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { uploadFile } = useUpload();
  const coverRef = useRef<HTMLInputElement>(null);

  const preselectedBubbleId = new URLSearchParams(search).get("bubbleId") ?? "";
  const [bubbleId, setBubbleId] = useState(preselectedBubbleId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [rsvpDeadline, setRsvpDeadline] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<(typeof RECURRENCE_OPTIONS)[number]["value"]>("never");
  const [recurrenceCustomFrequency, setRecurrenceCustomFrequency] = useState<(typeof CUSTOM_FREQUENCY_OPTIONS)[number]["value"]>("weekly");
  const [recurrenceCustomInterval, setRecurrenceCustomInterval] = useState("1");
  const [petFriendly, setPetFriendly] = useState(false);
  const [smokeFree, setSmokeFree] = useState(false);
  const [wheelchairAccessible, setWheelchairAccessible] = useState(false);
  const [campusOnly, setCampusOnly] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
  });
  const isCampusVerified = !!(me?.campusVerified && me?.campusId);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const handleCoverCapture = (f: File) => {
    setCameraOpen(false);
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const { data: myBubbles } = useQuery<any[]>({
    queryKey: ["/api/bubbles/my"],
    queryFn: () => apiRequest("GET", "/api/bubbles/my").then((r) => r.json()),
    enabled: !!user,
  });

  const selectedBubble = (myBubbles ?? []).find((b: any) => b.id === bubbleId);

  const createMutation = useMutation({
    mutationFn: async () => {
      let coverImage: string | undefined;
      if (coverFile) {
        const uploaded = await uploadFile(coverFile);
        if (!uploaded) throw new Error("Failed to upload cover image.");
        coverImage = uploaded.objectPath;
      }

      const body: Record<string, any> = {
        bubbleId,
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        startTime,
        endTime: endTime || undefined,
        locationName: locationName.trim() || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        coverImage,
        rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline).toISOString() : undefined,
        recurrenceType,
        recurrenceCustomFrequency: recurrenceType === "custom" ? recurrenceCustomFrequency : undefined,
        recurrenceCustomInterval: recurrenceType === "custom" ? Number(recurrenceCustomInterval) || 1 : undefined,
        petFriendly,
        smokeFree,
        wheelchairAccessible,
        campusId: selectedBubble?.campusId || (campusOnly && isCampusVerified ? me?.campusId : null),
      };
      if (capacity) body.attendeeLimit = Number(capacity);

      const res = await apiRequest("POST", "/api/events", body);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events/my"] });
      qc.invalidateQueries({ queryKey: ["/api/events/upcoming"] });
      setSubmitted(true);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to create event.");
    },
  });

  const handleSubmit = () => {
    setError("");
    if (!bubbleId) return setError("Please select a bubble.");
    if (!title.trim()) return setError("Event title is required.");
    if (!date) return setError("Date is required.");
    if (!startTime) return setError("Start time is required.");
    createMutation.mutate();
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (submitted) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-6 px-8"
        style={{ backgroundColor: BG }}
      >
        <CheckCircle2 className="h-16 w-16" style={{ color: BLUE }} />
        <div className="text-center">
          <div className="text-[22px] font-bold text-black">Event Created!</div>
          <div className="mt-2 text-[14px] text-black/50">
            Your event is live for bubble members.
          </div>
        </div>
        <button
          onClick={() => navigate("/upcoming")}
          className="h-12 w-full max-w-xs rounded-2xl text-[14px] font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${BLUE}, #6C63FF)` }}
          data-testid="button-view-events"
        >
          View Upcoming Events
        </button>
        <button
          onClick={() => {
            setSubmitted(false);
            setTitle("");
            setDescription("");
            setDate("");
            setStartTime("");
            setEndTime("");
            setLocationName("");
            setCapacity("");
            setBubbleId("");
            setCoverFile(null);
            setCoverPreview("");
            setRsvpDeadline("");
            setRecurrenceType("never");
            setRecurrenceCustomFrequency("weekly");
            setRecurrenceCustomInterval("1");
            setPetFriendly(false);
            setSmokeFree(false);
            setWheelchairAccessible(false);
          }}
          className="text-[13px] font-semibold"
          style={{ color: BLUE }}
          data-testid="button-create-another"
        >
          Create another event
        </button>
      </div>
    );
  }

  return (
    <AppShell active="explore">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate(-1 as any)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/8"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-black/60" />
          </button>
          <h1 className="text-[22px] font-bold text-black">Create Event</h1>
        </div>

        <div className="space-y-5">
          {/* Bubble selector */}
          <div>
            <Label>Bubble *</Label>
            <div
              className="relative flex items-center rounded-2xl bg-white px-4"
              style={{
                height: 52,
                border: "1px solid rgba(0,0,0,0.10)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}
            >
              <Users className="mr-3 h-4 w-4 shrink-0 text-black/35" />
              <select
                value={bubbleId}
                onChange={(e) => setBubbleId(e.target.value)}
                className="w-full bg-transparent text-[14px] text-black outline-none appearance-none"
                data-testid="select-bubble"
              >
                <option value="">Select a bubble</option>
                {(myBubbles ?? []).map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 shrink-0 text-black/35" />
            </div>
          </div>

          {/* Campus scope */}
          {selectedBubble?.campusId ? (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{ backgroundColor: "#EEF6FE" }}
              data-testid="banner-event-campus-inherited"
            >
              <GraduationCap className="h-4 w-4 shrink-0" style={{ color: BLUE }} />
              <span className="text-[13px] font-medium text-black/70">
                This event inherits its bubble's campus-only scope.
              </span>
            </div>
          ) : isCampusVerified ? (
            <div
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3"
              style={{ border: "1px solid rgba(0,0,0,0.10)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
              data-testid="option-event-campus-only"
            >
              <GraduationCap className="h-4 w-4 shrink-0" style={{ color: BLUE }} />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-black">Campus Only</div>
                <div className="text-[11px] text-black/45">Only students from your campus can see and join</div>
              </div>
              <button
                type="button"
                onClick={() => setCampusOnly((v) => !v)}
                className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                style={{ backgroundColor: campusOnly ? BLUE : "rgba(0,0,0,0.15)" }}
                data-testid="toggle-event-campus-only"
                role="switch"
                aria-checked={campusOnly}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: campusOnly ? "translateX(22px)" : "translateX(2px)" }}
                />
              </button>
            </div>
          ) : null}

          {/* Cover image */}
          <div>
            <Label>Cover Photo</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => coverRef.current?.click()}
                className="group relative w-full overflow-hidden rounded-2xl border border-dashed border-black/15 hover:border-[#35A8F7]"
                data-testid="button-event-cover-upload"
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="" className="h-36 w-full object-cover" data-testid="img-event-cover-preview" />
                ) : (
                  <div className="flex h-36 flex-col items-center justify-center gap-2 bg-white">
                    <ImagePlus className="h-6 w-6 text-black/35" />
                    <span className="text-[13px] font-semibold text-black/40">+ Add cover photo</span>
                  </div>
                )}
              </button>
              <TakePhotoButton
                onClick={() => setCameraOpen(true)}
                className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white shadow ring-1 ring-black/10 text-foreground"
                testId="button-event-cover-camera"
              />
            </div>
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
              data-testid="input-event-cover-file"
            />
            <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={handleCoverCapture} />
          </div>

          {/* Title */}
          <div>
            <Label>Event Title *</Label>
            <FieldWrap>
              <IconWrap icon={Type} />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's the event?"
                className="flex-1 bg-transparent text-[14px] text-black placeholder:text-black/30 outline-none"
                data-testid="input-event-title"
              />
            </FieldWrap>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date *</Label>
              <FieldWrap>
                <IconWrap icon={CalendarDays} />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 bg-transparent text-[14px] text-black outline-none"
                  data-testid="input-event-date"
                />
              </FieldWrap>
            </div>
            <div>
              <Label>Start Time *</Label>
              <FieldWrap>
                <IconWrap icon={Clock} />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="flex-1 bg-transparent text-[14px] text-black outline-none"
                  data-testid="input-event-start-time"
                />
              </FieldWrap>
            </div>
          </div>

          {/* End time + capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>End Time</Label>
              <FieldWrap>
                <IconWrap icon={Clock} />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="flex-1 bg-transparent text-[14px] text-black outline-none"
                  data-testid="input-event-end-time"
                />
              </FieldWrap>
            </div>
            <div>
              <Label>Capacity</Label>
              <FieldWrap>
                <IconWrap icon={Users} />
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="No limit"
                  min="1"
                  className="flex-1 bg-transparent text-[14px] text-black placeholder:text-black/30 outline-none"
                  data-testid="input-event-capacity"
                />
              </FieldWrap>
            </div>
          </div>

          {/* Location */}
          <div>
            <Label>Location</Label>
            <FieldWrap>
              <IconWrap icon={MapPin} />
              <input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Where is it happening?"
                className="flex-1 bg-transparent text-[14px] text-black placeholder:text-black/30 outline-none"
                data-testid="input-event-location"
              />
            </FieldWrap>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <TextAreaWrap>
              <div className="flex gap-3">
                <AlignLeft className="mt-0.5 h-4 w-4 shrink-0 text-black/35" />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell people what to expect..."
                  rows={4}
                  className="flex-1 resize-none bg-transparent text-[14px] text-black placeholder:text-black/30 outline-none"
                  data-testid="input-event-description"
                />
              </div>
            </TextAreaWrap>
          </div>

          {/* RSVP deadline */}
          <div>
            <Label>RSVP Deadline</Label>
            <FieldWrap>
              <IconWrap icon={CalendarClock} />
              <input
                type="datetime-local"
                value={rsvpDeadline}
                onChange={(e) => setRsvpDeadline(e.target.value)}
                className="flex-1 bg-transparent text-[14px] text-black outline-none"
                data-testid="input-event-rsvp-deadline"
              />
            </FieldWrap>
          </div>

          {/* Amenities / tags */}
          <div>
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map(({ key, label, icon: Icon }) => {
                const active =
                  key === "petFriendly" ? petFriendly : key === "smokeFree" ? smokeFree : wheelchairAccessible;
                const toggle =
                  key === "petFriendly"
                    ? () => setPetFriendly((v) => !v)
                    : key === "smokeFree"
                      ? () => setSmokeFree((v) => !v)
                      : () => setWheelchairAccessible((v) => !v);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={toggle}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-semibold transition",
                      active ? "border-[#35A8F7] bg-[#35A8F7]/10 text-[#35A8F7]" : "border-black/10 bg-white text-black/60",
                    )}
                    data-testid={`toggle-event-${key}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <Label>Repeat</Label>
            <div
              className="relative flex items-center rounded-2xl bg-white px-4"
              style={{ height: 52, border: "1px solid rgba(0,0,0,0.10)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
            >
              <Repeat className="mr-3 h-4 w-4 shrink-0 text-black/35" />
              <select
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value as typeof recurrenceType)}
                className="w-full bg-transparent text-[14px] text-black outline-none appearance-none"
                data-testid="select-event-recurrence"
              >
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 shrink-0 text-black/35" />
            </div>

            {recurrenceType === "custom" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div
                  className="flex items-center rounded-2xl bg-white px-4"
                  style={{ height: 52, border: "1px solid rgba(0,0,0,0.10)" }}
                >
                  <select
                    value={recurrenceCustomFrequency}
                    onChange={(e) => setRecurrenceCustomFrequency(e.target.value as typeof recurrenceCustomFrequency)}
                    className="w-full bg-transparent text-[14px] text-black outline-none appearance-none"
                    data-testid="select-event-recurrence-frequency"
                  >
                    {CUSTOM_FREQUENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <FieldWrap>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={recurrenceCustomInterval}
                    onChange={(e) => setRecurrenceCustomInterval(e.target.value)}
                    placeholder="Every N"
                    className="flex-1 bg-transparent text-[14px] text-black placeholder:text-black/30 outline-none"
                    data-testid="input-event-recurrence-interval"
                  />
                </FieldWrap>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-[13px] font-medium"
              style={{ backgroundColor: "#FFF0F0", color: "#E53935" }}
              data-testid="text-event-error"
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white disabled:opacity-60"
            style={{
              height: 52,
              background: `linear-gradient(135deg, ${BLUE}, #6C63FF)`,
              boxShadow: "0 10px 30px rgba(53,168,247,0.30)",
            }}
            data-testid="button-create-event"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Create Event"
            )}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
