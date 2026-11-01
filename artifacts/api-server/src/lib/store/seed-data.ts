export type SeedPackage = {
  id: string;
  title: string;
  description: string;
  priceKobo: number;
  totalOdds: string;
  matchCount: number;
  bettingCode: string;
};

/**
 * Starter catalogue inserted once on first boot, by both the Postgres and the
 * embedded SQLite backend. Rows are only seeded when the id is missing, so
 * operators can freely edit or deactivate packages afterwards.
 */
export const SEED_PACKAGES: SeedPackage[] = [
  {
    id: "6b1f5a70-0d7e-4a3b-9a51-1a3d6f0c8b11",
    title: "Weekend watchlist",
    description: "A considered selection across a busy weekend of European fixtures.",
    priceKobo: 4200,
    totalOdds: "8.64",
    matchCount: 5,
    bettingCode: "WKND-8641-5527",
  },
  {
    id: "9c2e7d41-5b6a-4f0d-8c37-2f9b1d4e6a22",
    title: "Midweek edition",
    description: "A compact collection built around midweek league matchups.",
    priceKobo: 2800,
    totalOdds: "5.18",
    matchCount: 3,
    bettingCode: "MDWK-5182-3391",
  },
  {
    id: "d4a8b3e2-7c15-49f8-b6d2-3e5a0c7b9f33",
    title: "Continental notes",
    description: "A longer-form example spanning selected continental fixtures.",
    priceKobo: 6700,
    totalOdds: "12.42",
    matchCount: 7,
    bettingCode: "CNTL-1242-7714",
  },
];
