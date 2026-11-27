-- Two login roles only: Dealer and Manufacturer.
-- Dealer Principal, Sales Representative and Service Technician become one
-- Dealer role with every dealer module. Existing users keep their accounts
-- (orders, sales and the audit log point to them); only their role changes.
INSERT INTO "Role" ("id", "name", "permissions")
SELECT 'dealer', 'Dealer', "permissions" FROM "Role" WHERE "id" = 'principal';

UPDATE "User" SET "roleId" = 'dealer' WHERE "roleId" IN ('principal', 'salesRep', 'technician');
DELETE FROM "Role" WHERE "id" IN ('principal', 'salesRep', 'technician');
UPDATE "Role" SET "name" = 'Manufacturer' WHERE "id" = 'manufacturer';

-- Demo sign-in emails: dealer@demo.com (Summit Comfort) and dealer2@demo.com (Coastal Climate).
UPDATE "User" SET "email" = 'dealer@demo.com' WHERE "email" = 'principal@demo.com';
UPDATE "User" SET "email" = 'dealer2@demo.com' WHERE "email" = 'principal2@demo.com';
