import { Router, type IRouter } from "express";

import { LookupOrderBody, LookupOrderResponse } from "@workspace/api-zod";
import { getStore } from "../lib/store";

const router: IRouter = Router();

/**
 * Returns the betting code for a paid order. Both the reference and the email
 * used at checkout must match, so a reference alone cannot reveal a code.
 */
router.post("/orders/lookup", async (req, res) => {
  const { email, reference } = LookupOrderBody.parse(req.body);

  const order = await getStore().lookupOrder({ reference, email });

  if (!order) {
    res.status(404).json({ error: "No order found for that email and reference." });
    return;
  }

  if (order.status !== "paid") {
    res.status(409).json({
      error:
        order.status === "failed"
          ? "That payment did not complete, so no code is available."
          : "That payment has not been confirmed yet. Check back shortly.",
    });
    return;
  }

  res.json(LookupOrderResponse.parse({ title: order.title, code: order.code }));
});

export default router;
