-- Per-card billing cycle window. Different Japanese cards use different windows that aren't
-- predictable from the due date alone. cycleStartDay = day-of-month the cycle opens (in the
-- prior calendar month), cycleEndDay = day-of-month the cycle closes. Both nullable; falling
-- back to a "due date − 16d" heuristic when absent.
ALTER TABLE "CreditDebt" ADD COLUMN IF NOT EXISTS "cycleStartDay" INTEGER;
ALTER TABLE "CreditDebt" ADD COLUMN IF NOT EXISTS "cycleEndDay" INTEGER;
