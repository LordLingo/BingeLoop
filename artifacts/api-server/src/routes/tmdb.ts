import { Router, type IRouter } from "express";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import {
  TmdbSearchQueryParams,
  TmdbSearchResponse,
  TmdbDetailsQueryParams,
  TmdbDetailsResponse,
} from "@workspace/api-zod";
import { searchMulti, getDetails } from "../lib/tmdb";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/tmdb/search", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = TmdbSearchQueryParams.safeParse(req.query);
  // The generated schema is `zod.coerce.string().min(1)`, which coerces a
  // missing param to the string "undefined" (passing min(1)). Guard explicitly
  // so an omitted/blank query reliably 400s instead of querying TMDB.
  const rawQuery = req.query.query;
  if (!parsed.success || typeof rawQuery !== "string" || rawQuery.trim() === "") {
    res.status(400).json({ error: "query is required" });
    return;
  }

  try {
    const hits = await searchMulti(parsed.data.query.trim());
    res.json(TmdbSearchResponse.parse(hits));
  } catch (err) {
    req.log.error({ err }, "TMDB search failed");
    res.status(502).json({ error: "TMDB search failed" });
  }
});

router.get("/tmdb/details", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = TmdbDetailsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const details = await getDetails(
      parsed.data.mediaType,
      parsed.data.tmdbId,
    );
    res.json(TmdbDetailsResponse.parse(details));
  } catch (err) {
    req.log.error({ err }, "TMDB details failed");
    res.json(
      TmdbDetailsResponse.parse({
        streamingProvider: null,
        streamingLogo: null,
        network: null,
      }),
    );
  }
});

export default router;
