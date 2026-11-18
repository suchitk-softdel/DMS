-- New dealer <-> manufacturer order flow: the dealer sends a request with
-- quantities, the manufacturer approves it and quotes catalogue prices, the
-- dealer accepts (then fulfils) or declines the quote. These columns record
-- the dealer's answer: who, when, and the reason for a decline.
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
    "acceptanceMethod" TEXT,
    "acceptanceContact" TEXT,
    "acceptanceNote" TEXT,
    "dealerRespondedById" TEXT,
    "dealerRespondedAt" DATETIME,
    "declineReason" TEXT,
    CONSTRAINT "Order_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_dealerRespondedById_fkey" FOREIGN KEY ("dealerRespondedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("acceptanceContact", "acceptanceMethod", "acceptanceNote", "createdAt", "createdById", "customerId", "dealerId", "id", "rejectionReason", "reviewedAt", "reviewedById", "status", "total", "type", "updatedAt") SELECT "acceptanceContact", "acceptanceMethod", "acceptanceNote", "createdAt", "createdById", "customerId", "dealerId", "id", "rejectionReason", "reviewedAt", "reviewedById", "status", "total", "type", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_dealerId_createdAt_idx" ON "Order"("dealerId", "createdAt");
CREATE INDEX "Order_dealerId_status_idx" ON "Order"("dealerId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

