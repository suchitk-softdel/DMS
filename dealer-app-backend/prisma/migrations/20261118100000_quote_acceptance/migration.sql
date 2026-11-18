-- Quotes: the dealer records how the customer accepted (email, phone, signed
-- copy, in person), the customer contact and an optional note. Who recorded
-- it and when use the existing reviewedById / reviewedAt columns.
-- AlterTable
ALTER TABLE "Order" ADD COLUMN "acceptanceContact" TEXT;
ALTER TABLE "Order" ADD COLUMN "acceptanceMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN "acceptanceNote" TEXT;


-- Quotes accepted before this change: who recorded the acceptance and when,
-- from the audit log (how the customer accepted was not recorded then).
UPDATE "Order"
SET "reviewedAt" = (SELECT MIN(a."createdAt") FROM "AuditLog" a WHERE a."entityId" = "Order"."id" AND a."action" = 'quote.status' AND json_extract(a."details", '$.to') = 'approved'),
    "reviewedById" = (SELECT a."userId" FROM "AuditLog" a WHERE a."entityId" = "Order"."id" AND a."action" = 'quote.status' AND json_extract(a."details", '$.to') = 'approved' ORDER BY a."createdAt" LIMIT 1)
WHERE "type" = 'quote' AND "status" = 'approved' AND "reviewedAt" IS NULL;
