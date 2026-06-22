import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entriesRouter from "./entries";
import activityRouter from "./activity";
import watchlistRouter from "./watchlist";
import approvalsRouter from "./approvals";
import spiceRouter from "./spice";
import commentsRouter from "./comments";
import topFourRouter from "./topFour";
import invitesRouter from "./invites";
import groupsRouter from "./groups";

const router: IRouter = Router();

router.use(healthRouter);
router.use(invitesRouter);
router.use(groupsRouter);
router.use(entriesRouter);
router.use(activityRouter);
router.use(watchlistRouter);
router.use(approvalsRouter);
router.use(spiceRouter);
router.use(commentsRouter);
router.use(topFourRouter);

export default router;
