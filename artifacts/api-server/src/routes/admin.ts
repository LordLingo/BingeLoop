import { Router, type IRouter } from "express";
import { sql, gte, count } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  userActivityTable,
  groupsTable,
  entriesTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { isAdminUser } from "../lib/admin";
import { GetAdminStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

// Build a zero-filled YYYY-MM-DD series for the last `days` days (oldest first),
// merging in the per-day counts we got from the DB. UTC days keep the series
// stable regardless of server timezone.
function buildSignupSeries(
  rows: { date: string; count: number }[],
  days: number,
): { date: string; count: number }[] {
  const byDate = new Map(rows.map((r) => [r.date, r.count]));
  const out: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: byDate.get(key) ?? 0 });
  }
  return out;
}

router.get("/admin/stats", async (req: AuthedRequest, res): Promise<void> => {
  if (!(await isAdminUser(req.userId!))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [
    [{ total: totalUsers }],
    [{ total: newUsersLast7Days }],
    [{ total: activeUsersLast7Days }],
    [{ total: totalGroups }],
    [{ total: totalEntries }],
    signupRows,
  ] = await Promise.all([
    db.select({ total: count() }).from(userProfilesTable),
    db
      .select({ total: count() })
      .from(userProfilesTable)
      .where(gte(userProfilesTable.createdAt, sql`now() - interval '7 days'`)),
    db
      .select({ total: count() })
      .from(userActivityTable)
      .where(gte(userActivityTable.lastSeenAt, sql`now() - interval '7 days'`)),
    db.select({ total: count() }).from(groupsTable),
    db.select({ total: count() }).from(entriesTable),
    db
      .select({
        date: sql<string>`to_char(${userProfilesTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(userProfilesTable)
      .where(gte(userProfilesTable.createdAt, sql`now() - interval '30 days'`))
      .groupBy(sql`1`),
  ]);

  res.json(
    GetAdminStatsResponse.parse({
      totalUsers,
      newUsersLast7Days,
      activeUsersLast7Days,
      totalGroups,
      totalEntries,
      signupsByDay: buildSignupSeries(signupRows, 30),
    }),
  );
});

export default router;
