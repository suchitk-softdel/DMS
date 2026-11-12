// Data generator (planned, not implemented yet).
//
// TODO: Generate 3–4 years of seeded, reproducible dummy data and write it to
// src/data/ so the screens have realistic mock data while the app runs
// without a backend (VITE_USE_MOCK_DATA=true). Once the backend exists it
// can reuse this script to seed its development database.
//
// Planned behaviour:
// - Use a seeded pseudo-random generator (e.g. mulberry32) so every run
//   produces identical data for the same seed.
// - Output files: products.js, sales.js (monthly units/revenue/cost per
//   dealer and product), orders.js and claims.js.
// - Build in HVAC seasonality (summer cooling and winter heating peaks, with
//   a strong November/December pre-season), a year-over-year growth trend,
//   a different scale for each dealer, and random noise.
// - Keep ids consistent with src/data/dealers.js and src/data/users.js.
//
// Planned usage:
//   node scripts/generateData.js --seed 42 --years 4
