import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

export default function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [attendeeLimit, setAttendeeLimit] = useState("");
  const [bubbleId, setBubbleId] = useState("");

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      try {
        const res = await fetch(`/api/events/${id}`);
        const event = await res.json();
        if (!res.ok || event.error) {
          setLoadError(event.error || "Event not found");
          return;
        }
        if (event.createdBy !== user.id && !user.isSuperAdmin) {
          setNotAuthorized(true);
          return;
        }
        setTitle(event.title ?? "");
        setDescription(event.description ?? "");
        setDate(event.date ?? "");
        setStartTime(event.startTime ?? "");
        setEndTime(event.endTime ?? "");
        setLocationName(event.locationName ?? "");
        setAttendeeLimit(event.attendeeLimit ? String(event.attendeeLimit) : "");
        setBubbleId(event.bubbleId);
      } catch (err: any) {
        setLoadError(err.message || "Failed to load event");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user]);

  const handleSave = async () => {
    if (!title.trim() || !date || !startTime) {
      setSaveError("Title, date, and start time are required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const attendeeLimitNum = attendeeLimit && !isNaN(parseInt(attendeeLimit)) ? parseInt(attendeeLimit) : null;
      const res = await apiRequest("PUT", `/api/events/${id}`, {
        title: title.trim(),
        description: description.trim() || null,
        date,
        startTime,
        endTime: endTime || null,
        locationName: locationName.trim() || null,
        attendeeLimit: attendeeLimitNum,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || "Failed to save changes");
        setSaving(false);
        return;
      }
      await qc.invalidateQueries({ queryKey: [`/api/events/${id}`] });
      await qc.invalidateQueries({ queryKey: ["/api/events/my"] });
      await qc.invalidateQueries({ queryKey: ["/api/events/upcoming"] });
      toast({ title: "Event updated" });
      navigate(`/event/${id}`);
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
      <div className="flex min-h-dvh items-center justify-center bg-background" data-testid="loading-edit-event">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center" data-testid="error-edit-event">
        <div className="text-sm text-muted-foreground">{loadError}</div>
      </div>
    );
  }

  if (notAuthorized) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center" data-testid="not-authorized-edit-event">
        <div className="text-sm font-semibold">Only the event organizer can edit this event.</div>
        <Button variant="outline" onClick={() => navigate(`/event/${id}`)}>Back to Event</Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/85 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => navigate(`/event/${id}`)} className="flex h-10 w-10 items-center justify-center rounded-full" data-testid="button-edit-event-back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-[16px] font-bold" data-testid="text-edit-event-title">Edit Event</span>
        <div className="h-10 w-10" aria-hidden />
      </div>

      <div className="mx-auto w-full max-w-md space-y-5 px-5 py-6">
        <div className="space-y-2">
          <Label htmlFor="edit-event-title">Title</Label>
          <Input id="edit-event-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} data-testid="input-edit-event-title" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-event-description">Description</Label>
          <Textarea id="edit-event-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} data-testid="input-edit-event-description" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="edit-event-date">Date</Label>
            <Input id="edit-event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-edit-event-date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-event-start">Start time</Label>
            <Input id="edit-event-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="input-edit-event-start-time" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-event-end">End time (optional)</Label>
          <Input id="edit-event-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="input-edit-event-end-time" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-event-location">Location</Label>
          <Input id="edit-event-location" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g. Golden Gate Park" data-testid="input-edit-event-location" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-event-limit">Attendee limit (optional)</Label>
          <Input id="edit-event-limit" type="number" min={1} value={attendeeLimit} onChange={(e) => setAttendeeLimit(e.target.value)} data-testid="input-edit-event-limit" />
        </div>

        {saveError && (
          <p className="text-sm text-destructive" data-testid="text-edit-event-error">{saveError}</p>
        )}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-12 w-full rounded-full text-base font-semibold"
          data-testid="button-save-edit-event"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
