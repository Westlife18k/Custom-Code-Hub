import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";

import { db, packagesTable } from "@workspace/db";
import { ListPackagesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Public catalogue. Only active packages are exposed and the internal betting
 * code is never included in the response.
 */
router.get("/packages", async (_req, res) => {
  const rows = await db
    .select({
      id: packagesTable.id,
      title: packagesTable.title,
      description: packagesTable.description,
      price_kobo: packagesTable.priceKobo,
      total_odds: packagesTable.totalOdds,
      match_count: packagesTable.matchCount,
    })
    .from(packagesTable)
    .where(eq(packagesTable.active, true))
    .orderBy(asc(packagesTable.priceKobo));

  res.json(ListPackagesResponse.parse(rows));
});

export default router;
