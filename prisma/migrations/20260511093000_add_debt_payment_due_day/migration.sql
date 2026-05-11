-- Add monthly payment due day for tracked debts.
ALTER TABLE "CreditDebt" ADD COLUMN "paymentDueDay" INTEGER;
ALTER TABLE "CreditDebt" ADD CONSTRAINT "CreditDebt_paymentDueDay_check" CHECK ("paymentDueDay" IS NULL OR ("paymentDueDay" >= 1 AND "paymentDueDay" <= 31));
