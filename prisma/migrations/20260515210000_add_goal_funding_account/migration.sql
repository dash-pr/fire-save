-- Goals can be backed by a real savings account. The cash never moves; the goal balance is a
-- claim on that account, displayed as "usable" vs "total" on the sidebar.
ALTER TABLE "SavingsGoal" ADD COLUMN IF NOT EXISTS "fundingAccountId" TEXT;
CREATE INDEX IF NOT EXISTS "SavingsGoal_fundingAccountId_idx" ON "SavingsGoal"("fundingAccountId");
ALTER TABLE "SavingsGoal" DROP CONSTRAINT IF EXISTS "SavingsGoal_fundingAccountId_fkey";
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_fundingAccountId_fkey" FOREIGN KEY ("fundingAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
