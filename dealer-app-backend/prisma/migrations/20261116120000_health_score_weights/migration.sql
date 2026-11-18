-- Health Score component weights per manufacturer (FR-D360-6), so a
-- Manufacturer Administrator can change them without a code change.

-- CreateTable
CREATE TABLE "HealthScoreWeight" (
    "manufacturerId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "weight" REAL NOT NULL,

    PRIMARY KEY ("manufacturerId", "component"),
    CONSTRAINT "HealthScoreWeight_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Start every existing manufacturer on the default weights.
INSERT INTO "HealthScoreWeight" ("manufacturerId", "component", "weight")
SELECT "id", 'revenueGrowth', 0.3 FROM "Manufacturer"
UNION ALL SELECT "id", 'orderVelocity', 0.25 FROM "Manufacturer"
UNION ALL SELECT "id", 'warrantyCompliance', 0.25 FROM "Manufacturer"
UNION ALL SELECT "id", 'trainingCompletion', 0.2 FROM "Manufacturer";
