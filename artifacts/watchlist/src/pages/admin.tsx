import { useEffect } from "react";
import { useLocation } from "wouter";
import { format, parseISO } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Users, UserPlus, Activity, Layers, Clapperboard } from "lucide-react";
import {
  useGetProfile,
  useGetAdminStats,
  getGetAdminStatsQueryKey,
} from "@workspace/api-client-react";

function StatCard({
  icon: Icon,
  value,
  label,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="bg-black/[0.03] rounded-2xl p-4 border border-black/10">
      <div className="flex items-center gap-2 text-primary/70 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-3xl sm:text-4xl font-serif text-foreground leading-none">
        {value}
      </div>
      {sub && (
        <div className="text-sm text-muted-foreground mt-1.5 font-medium">
          {sub}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { data: profile, isLoading: profileLoading } = useGetProfile();
  const isAdmin = profile?.isAdmin === true;

  const { data: stats, isLoading: statsLoading } = useGetAdminStats({
    query: { enabled: isAdmin, queryKey: getGetAdminStatsQueryKey() },
  });

  // Lock the page to the admin: once the profile resolves, bounce anyone else.
  useEffect(() => {
    if (!profileLoading && profile && !isAdmin) {
      setLocation("/library", { replace: true });
    }
  }, [profileLoading, profile, isAdmin, setLocation]);

  if (profileLoading || (isAdmin && statsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  const chartData =
    stats?.signupsByDay.map((p) => ({
      date: p.date,
      label: format(parseISO(p.date), "MMM d"),
      count: p.count,
    })) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10">
        <header className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-serif tracking-wide text-foreground">
            Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            App-wide totals. Aggregate numbers only.
          </p>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            icon={Users}
            value={stats?.totalUsers ?? 0}
            label="Total Users"
            sub={`+${stats?.newUsersLast7Days ?? 0} in last 7 days`}
          />
          <StatCard
            icon={Activity}
            value={stats?.activeUsersLast7Days ?? 0}
            label="Active (7d)"
            sub="Users active this week"
          />
          <StatCard
            icon={Layers}
            value={stats?.totalGroups ?? 0}
            label="Groups"
          />
          <StatCard
            icon={Clapperboard}
            value={stats?.totalEntries ?? 0}
            label="Shows Logged"
            sub="Movies & TV across the app"
          />
          <StatCard
            icon={UserPlus}
            value={stats?.newUsersLast7Days ?? 0}
            label="New Users (7d)"
          />
        </div>

        <section className="mt-6 poster-card rounded-2xl p-4 sm:p-5">
          <h2 className="text-lg font-serif tracking-wide text-foreground mb-1">
            Signups — last 30 days
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Daily new accounts
          </p>
          <div className="h-56 sm:h-64 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.4}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  interval={6}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  width={28}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    color: "hsl(var(--foreground))",
                    fontSize: "0.8rem",
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
                <Bar
                  dataKey="count"
                  name="Signups"
                  fill="hsl(var(--primary))"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
