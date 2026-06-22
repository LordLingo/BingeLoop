import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entriesRouter from "./entries";
import activityRouter from "./activity";
import watchlistRouter from "./watchlist";
import approvalsRouter from "./approvals";
import spiceRouter from "./spice";
import commentsRouter from "./comments";
import topFourRouter from "./topFour";
import listsRouter from "./lists";
import reactionsRouter from "./reactions";
import invitesRouter from "./invites";
import groupsRouter from "./groups";
import tmdbRouter from "./tmdb";

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
router.use(listsRouter);
router.use(reactionsRouter);
router.use(tmdbRouter);

export default router;
