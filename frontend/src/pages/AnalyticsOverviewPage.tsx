import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Stat } from "../components/ui/Stat";
import { usersListSchoolUsers } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { useAuth } from "../state/auth-context";

const ROLE_COLORS = ["#1e40af", "#0f766e", "#92400e", "#7c3aed", "#0f172a"];
const STATUS_COLORS = ["#166534", "#92400e", "#991b1b", "#1e3a8a"];

export function AnalyticsOverviewPage() {
  const { session } = useAuth();

  const usersQuery = useQuery({
    queryKey: session?.me.school_id ? queryKeys.users.school(session.me.school_id, { role: "all", status: "all" }) : ["users", "empty"],
    queryFn: async () => {
      if (!session || !session.me.school_id) {
        throw new Error("School id is required.");
      }
      return usersListSchoolUsers(session.tokens.access_token, session.me.school_id, { role: "all", status: "all" });
    },
    enabled: Boolean(session?.me.school_id)
  });

  const roleData = useMemo(() => {
    const buckets = new Map<string, number>();
    (usersQuery.data?.users || []).forEach((user) => {
      buckets.set(user.role, (buckets.get(user.role) || 0) + 1);
    });
    return Array.from(buckets.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);
  }, [usersQuery.data?.users]);

  const statusData = useMemo(() => {
    const buckets = new Map<string, number>();
    (usersQuery.data?.users || []).forEach((user) => {
      buckets.set(user.status, (buckets.get(user.status) || 0) + 1);
    });
    return Array.from(buckets.entries()).map(([status, count]) => ({ status, count }));
  }, [usersQuery.data?.users]);

  const teacherCount = roleData.find((item) => item.role === "teacher")?.count || 0;
  const studentCount = roleData.find((item) => item.role === "student")?.count || 0;

  return (
    <AppShell>
      <section className="content-stack">
        <section className="panel-grid">
          <Stat label="Users in School" value={usersQuery.data?.filtered_total || 0} />
          <Stat label="Teachers" value={teacherCount} />
          <Stat label="Students" value={studentCount} />
          <Stat label="Active" value={statusData.find((item) => item.status === "active")?.count || 0} />
        </section>

        {usersQuery.isLoading ? (
          <Card>
            <Card.Body>
              <EmptyState title="Загрузка аналитики..." />
            </Card.Body>
          </Card>
        ) : null}

        {!usersQuery.isLoading && !roleData.length ? (
          <Card>
            <Card.Body>
              <EmptyState title="Нет данных для построения графиков" description="Проверьте наличие пользователей в школе." />
            </Card.Body>
          </Card>
        ) : null}

        {!!roleData.length && (
          <section className="panel-grid analytics-grid">
            <Card>
              <Card.Header>
                <h3>Распределение ролей</h3>
              </Card.Header>
              <Card.Body>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={roleData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="role" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {roleData.map((entry, index) => (
                          <Cell key={entry.role} fill={ROLE_COLORS[index % ROLE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h3>Статусы пользователей</h3>
              </Card.Header>
              <Card.Body>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={statusData} dataKey="count" nameKey="status" innerRadius={60} outerRadius={92} label>
                        {statusData.map((entry, index) => (
                          <Cell key={entry.status} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card.Body>
            </Card>
          </section>
        )}
      </section>
    </AppShell>
  );
}
