import { Router, type IRouter } from "express";
import healthRouter from "./health";
import packagesRouter from "./packages";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import depositsRouter from "./deposits";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(packagesRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(depositsRouter);
router.use(adminRouter);

export default router;
