ALTER TABLE "event_attendees"
  ADD COLUMN IF NOT EXISTS "reminder_24h_sent" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reminder_1h_sent" boolean NOT NULL DEFAULT false;

-- Backfill: mark existing attendees as having received reminders for any
-- event that already had its event-wide reminder batch sent.  This prevents
-- duplicate push notifications to attendees who were already notified under
-- the old event-level tracking model.
UPDATE event_attendees ea
SET reminder_24h_sent = true
FROM events e
WHERE ea.event_id = e.id
  AND e.reminder_24h_sent = true
  AND ea.reminder_24h_sent = false;

UPDATE event_attendees ea
SET reminder_1h_sent = true
FROM events e
WHERE ea.event_id = e.id
  AND e.reminder_1h_sent = true
  AND ea.reminder_1h_sent = false;
