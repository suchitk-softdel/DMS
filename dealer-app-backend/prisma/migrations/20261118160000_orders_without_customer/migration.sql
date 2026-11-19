-- The app is dealer <-> manufacturer only: new orders, warranty registrations
-- and claims no longer need an end customer. Past demo data keeps its customers.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealerId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "serialNumber" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "filedAt" DATETIME NOT NULL,
    "stageChangedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    CONSTRAINT "Claim_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Claim_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "WarrantyRegistration" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Claim_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Claim_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Claim_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Claim" ("amount", "customerId", "dealerId", "description", "filedAt", "id", "orderId", "productId", "registrationId", "resolvedAt", "serialNumber", "stage", "stageChangedAt") SELECT "amount", "customerId", "dealerId", "description", "filedAt", "id", "orderId", "productId", "registrationId", "resolvedAt", "serialNumber", "stage", "stageChangedAt" FROM "Claim";
DROP TABLE "Claim";
ALTER TABLE "new_Claim" RENAME TO "Claim";
CREATE INDEX "Claim_dealerId_stage_idx" ON "Claim"("dealerId", "stage");
CREATE INDEX "Claim_orderId_idx" ON "Claim"("orderId");
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealerId" TEXT NOT NULL,
    "customerId" TEXT,
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
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_dealerRespondedById_fkey" FOREIGN KEY ("dealerRespondedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("acceptanceContact", "acceptanceMethod", "acceptanceNote", "createdAt", "createdById", "customerId", "dealerId", "dealerRespondedAt", "dealerRespondedById", "declineReason", "id", "rejectionReason", "reviewedAt", "reviewedById", "status", "total", "type", "updatedAt") SELECT "acceptanceContact", "acceptanceMethod", "acceptanceNote", "createdAt", "createdById", "customerId", "dealerId", "dealerRespondedAt", "dealerRespondedById", "declineReason", "id", "rejectionReason", "reviewedAt", "reviewedById", "status", "total", "type", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_dealerId_createdAt_idx" ON "Order"("dealerId", "createdAt");
CREATE INDEX "Order_dealerId_status_idx" ON "Order"("dealerId", "status");
CREATE TABLE "new_WarrantyRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "serialNumber" TEXT NOT NULL,
    "installDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "WarrantyRegistration_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyRegistration_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyRegistration_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyRegistration_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyRegistration_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WarrantyRegistration" ("createdAt", "customerId", "dealerId", "id", "installDate", "orderId", "orderItemId", "productId", "serialNumber") SELECT "createdAt", "customerId", "dealerId", "id", "installDate", "orderId", "orderItemId", "productId", "serialNumber" FROM "WarrantyRegistration";
DROP TABLE "WarrantyRegistration";
ALTER TABLE "new_WarrantyRegistration" RENAME TO "WarrantyRegistration";
CREATE UNIQUE INDEX "WarrantyRegistration_serialNumber_key" ON "WarrantyRegistration"("serialNumber");
CREATE INDEX "WarrantyRegistration_dealerId_idx" ON "WarrantyRegistration"("dealerId");
CREATE INDEX "WarrantyRegistration_orderId_idx" ON "WarrantyRegistration"("orderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

