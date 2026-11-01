import { Router, type IRouter } from "express";

import { ListPackagesResponse } from "@workspace/api-zod";
import { getStore } from "../lib/store";

const router: IRouter = Router();

/**
 * Public catalogue. Only active packages are exposed and the internal betting
 * code is never included in the response.
 */
router.get("/packages", async (_req, res) => {
  const rows = await getStore().listActivePackages();
  res.json(ListPackagesResponse.parse(rows));
});

export default router;
