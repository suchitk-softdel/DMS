-- Place Orders: the dealer sells products it has on hand to its customers,
-- at a selling price above the manufacturer's base price.
CREATE TABLE "DealerSale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dealerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "basePrice" REAL NOT NULL,
    "sellingPrice" REAL NOT NULL,
    "soldById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DealerSale_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DealerSale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DealerSale_soldById_fkey" FOREIGN KEY ("soldById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "DealerSale_dealerId_createdAt_idx" ON "DealerSale"("dealerId", "createdAt");

-- The new Place Orders module: the dealer principal and the sales rep sell.
UPDATE "Role" SET "permissions" = '["home","dealer360","orders","placeOrders","inventory","incentives","warranty","salesCoach"]' WHERE "id" = 'principal';
UPDATE "Role" SET "permissions" = '["home","orders","placeOrders","inventory","incentives","salesCoach"]' WHERE "id" = 'salesRep';
