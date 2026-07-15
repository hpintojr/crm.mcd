-- Additive enum value for automated scheduled cadence check-in Service Cases.
-- Existing rows are unaffected; UI reads trigger::text and the cadence sweep's
-- read path compares trigger as text, so this label is only required before
-- the sweep's mutation path can run (i.e., before SERVICING_ENABLED opens).
ALTER TYPE "ClientServiceTrigger" ADD VALUE IF NOT EXISTS 'SERVICE_CADENCE';
