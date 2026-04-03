import { useState } from "react";
import { useLocation } from "wouter";
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
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

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
  const { user } = useAuth();
  const qc = useQueryClient();

  const [bubbleId, setBubbleId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: myBubbles } = useQuery<any[]>({
    queryKey: ["/api/bubbles/my"],
    queryFn: () => apiRequest("GET", "/api/bubbles/my").then((r) => r.json()),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {
        bubbleId,
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        startTime,
        endTime: endTime || undefined,
        locationName: locationName.trim() || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      if (capacity) body.capacity = Number(capacity);

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
    <AppShell active="">
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
