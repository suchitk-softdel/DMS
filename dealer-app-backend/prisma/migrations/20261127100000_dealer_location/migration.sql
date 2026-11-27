-- Dealer location (latitude, longitude) for the dealer map on Order Approvals.
-- The demo dealers get the centre of their city.
ALTER TABLE "Dealer" ADD COLUMN "latitude" REAL;
ALTER TABLE "Dealer" ADD COLUMN "longitude" REAL;

UPDATE "Dealer" SET "latitude" = 39.7392, "longitude" = -104.9903 WHERE "id" = 'd-1001'; -- Denver, CO
UPDATE "Dealer" SET "latitude" = 27.9506, "longitude" = -82.4572 WHERE "id" = 'd-1002'; -- Tampa, FL
UPDATE "Dealer" SET "latitude" = 41.2565, "longitude" = -95.9345 WHERE "id" = 'd-1003'; -- Omaha, NE
UPDATE "Dealer" SET "latitude" = 43.0731, "longitude" = -89.4012 WHERE "id" = 'd-1004'; -- Madison, WI
UPDATE "Dealer" SET "latitude" = 30.2672, "longitude" = -97.7431 WHERE "id" = 'd-1005'; -- Austin, TX
UPDATE "Dealer" SET "latitude" = 45.5152, "longitude" = -122.6784 WHERE "id" = 'd-1006'; -- Portland, OR
