-- Dealer orders are approved (or rejected) by the manufacturer:
-- - a user can belong to the manufacturer instead of a dealer
-- - orders record who reviewed them, when, and why an order was rejected
-- - a "manufacturer" role whose only module is Order Approvals, and one
--   demo order-desk user for Aerovance (same demo password as the others)
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    CONSTRAINT "Order_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("createdAt", "createdById", "customerId", "dealerId", "id", "status", "total", "type", "updatedAt") SELECT "createdAt", "createdById", "customerId", "dealerId", "id", "status", "total", "type", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_dealerId_createdAt_idx" ON "Order"("dealerId", "createdAt");
CREATE INDEX "Order_dealerId_status_idx" ON "Order"("dealerId", "status");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "dealerId" TEXT,
    "manufacturerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "dealerId", "email", "id", "name", "passwordHash", "roleId") SELECT "createdAt", "dealerId", "email", "id", "name", "passwordHash", "roleId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Manufacturer role and the demo order-desk user.
INSERT INTO "Role" ("id", "name", "permissions") VALUES ('manufacturer', 'Manufacturer Order Desk', '["orderApprovals"]');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "roleId", "dealerId", "manufacturerId", "createdAt")
SELECT 'u-m01', 'Aerovance Order Desk', 'manufacturer@demo.com', "passwordHash", 'manufacturer', NULL, 'm-01', '2024-11-01T00:00:00.000+00:00'
FROM "User" WHERE "email" = 'principal@demo.com' AND EXISTS (SELECT 1 FROM "Manufacturer" WHERE "id" = 'm-01');

-- Orders currently approved were approved by the manufacturer's order desk,
-- at the time recorded in the audit log.
UPDATE "Order"
SET "reviewedById" = 'u-m01',
    "reviewedAt" = (SELECT MIN(a."createdAt") FROM "AuditLog" a WHERE a."entityId" = "Order"."id" AND a."action" = 'order.status' AND json_extract(a."details", '$.to') = 'approved')
WHERE "type" = 'order' AND "status" = 'approved' AND EXISTS (SELECT 1 FROM "User" WHERE "id" = 'u-m01');
UPDATE "AuditLog" SET "userId" = 'u-m01'
WHERE "action" = 'order.status' AND json_extract("details", '$.to') = 'approved' AND EXISTS (SELECT 1 FROM "User" WHERE "id" = 'u-m01');
