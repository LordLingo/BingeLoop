import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entriesRouter from "./entries";
import activityRouter from "./activity";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entriesRouter);
router.use(activityRouter);

export default router;
