-- Warranty per product, 1 year from the install date by default.
-- Claims for a unit whose warranty has expired are refused by the backend.
ALTER TABLE "Product" ADD COLUMN "warrantyYears" INTEGER NOT NULL DEFAULT 1;
