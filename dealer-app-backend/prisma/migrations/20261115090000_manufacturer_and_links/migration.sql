-- Claims and warranty registrations now link to the order they came from, and
-- dealers belong to a manufacturer. Old rows can't be linked, so the demo data
-- is cleared here and reloaded from prisma/dataset with: npm run db:seed
DELETE FROM "AuditLog";
DELETE FROM "Sale";
DELETE FROM "IncentiveProgress";
DELETE FROM "Opportunity";
DELETE FROM "TrainingProgress";
DELETE FROM "TrainingCourse";
DELETE FROM "IncentiveProgram";
DELETE FROM "Claim";
DELETE FROM "WarrantyRegistration";
DELETE FROM "Inventory";
DELETE FROM "OrderItem";
DELETE FROM "Order";
DELETE FROM "Customer";
DELETE FROM "Product";
DELETE FROM "User";
DELETE FROM "Role";
DELETE FROM "Dealer";

-- AlterTable
ALTER TABLE "IncentiveProgram" ADD COLUMN "productCategory" TEXT;

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "headquarters" TEXT NOT NULL,
    "productLines" TEXT NOT NULL,
    "warrantyYears" INTEGER NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealerId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
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
    CONSTRAINT "Claim_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Claim" ("amount", "customerId", "dealerId", "description", "filedAt", "id", "productId", "resolvedAt", "serialNumber", "stage", "stageChangedAt") SELECT "amount", "customerId", "dealerId", "description", "filedAt", "id", "productId", "resolvedAt", "serialNumber", "stage", "stageChangedAt" FROM "Claim";
DROP TABLE "Claim";
ALTER TABLE "new_Claim" RENAME TO "Claim";
CREATE INDEX "Claim_dealerId_stage_idx" ON "Claim"("dealerId", "stage");
CREATE INDEX "Claim_orderId_idx" ON "Claim"("orderId");
CREATE TABLE "new_Dealer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "territoryCoverage" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dealer_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Dealer" ("city", "createdAt", "id", "name", "region", "state", "status", "territoryCoverage", "tier") SELECT "city", "createdAt", "id", "name", "region", "state", "status", "territoryCoverage", "tier" FROM "Dealer";
DROP TABLE "Dealer";
ALTER TABLE "new_Dealer" RENAME TO "Dealer";
CREATE TABLE "new_WarrantyRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "installDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "WarrantyRegistration_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyRegistration_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyRegistration_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyRegistration_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyRegistration_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WarrantyRegistration" ("createdAt", "customerId", "dealerId", "id", "installDate", "productId", "serialNumber") SELECT "createdAt", "customerId", "dealerId", "id", "installDate", "productId", "serialNumber" FROM "WarrantyRegistration";
DROP TABLE "WarrantyRegistration";
ALTER TABLE "new_WarrantyRegistration" RENAME TO "WarrantyRegistration";
CREATE UNIQUE INDEX "WarrantyRegistration_serialNumber_key" ON "WarrantyRegistration"("serialNumber");
CREATE INDEX "WarrantyRegistration_dealerId_idx" ON "WarrantyRegistration"("dealerId");
CREATE INDEX "WarrantyRegistration_orderId_idx" ON "WarrantyRegistration"("orderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
