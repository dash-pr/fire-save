-- A user can mark a card transaction as "converted to ribo" — the charge stops counting toward
-- the next billing cycle and the card's revolving balance increases by the amount instead. The
-- timestamp doubles as a flag (NULL = normal charge, not-NULL = converted at this moment).
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "convertedToRiboAt" TIMESTAMP(3);
