-- Track whether a budget row's assigned amount was manually set vs auto-calculated.
ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "isManuallySet" BOOLEAN NOT NULL DEFAULT false;
