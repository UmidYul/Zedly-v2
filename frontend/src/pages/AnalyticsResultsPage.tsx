import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Select } from "../components/ui/FormFields";
import { Stat } from "../components/ui/Stat";
import { analyticsTeacherDashboard } from "../lib/api";
import { useAuth } from "../state/auth-context";

type PeriodKey = "7d" | "30d" | "90d";

const PERIOD_OPTIONS: Array<{ value: PeriodKey; label: string }> = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" }
];

export function AnalyticsResultsPage() {
  const { session } = useAuth();
  const teacherClasses = session?.me.teacher_classes || [];
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");

  const periodTrendQuery = useQuery({
    queryKey: ["analytics", "teacher", "trend", period],
    queryFn: async () => {
      if (!session) {
        throw new Error("No session");
      }
      const periods: PeriodKey[] = ["7d", "30d", "90d"];
      const responses = await Promise.all(
        periods.map((key) => analyticsTeacherDashboard(session.tokens.access_token, { period: key }))
      );
      return periods.map((key, index) => ({
        period: key,
        class_average: responses[index].class_average,
        completed_sessions: responses[index].completed_sessions
      }));
    },
    enabled: Boolean(session)
  });

  const scopeDashboardQuery = useQuery({
    queryKey: ["analytics", "teacher", "scope", period, selectedClassId],
    queryFn: async () => {
      if (!session) {
        throw new Error("No session");
      }
      return analyticsTeacherDashboard(session.tokens.access_token, {
        period,
        class_id: selectedClassId === "all" ? undefined : selectedClassId
      });
    },
    enabled: Boolean(session)
  });

  const classComparisonQuery = useQuery({
    queryKey: ["analytics", "teacher", "classes", period, teacherClasses.map((item) => item.class_id).join(",")],
    queryFn: async () => {
      if (!session || !teacherClasses.length) {
        return [];
      }
      const rows = await Promise.all(
        teacherClasses.map(async (item) => {
          const response = await analyticsTeacherDashboard(session.tokens.access_token, {
            period,
            class_id: item.class_id
          });
          return {
            className: item.class_name,
            class_average: response.class_average,
            completed_sessions: response.completed_sessions
          };
        })
      );
      return rows;
    },
    enabled: Boolean(session && teacherClasses.length)
  });

  const weakTopics = useMemo(() => {
    const list = scopeDashboardQuery.data?.weak_topics || [];
    return list.slice(0, 8).map((item, index) => ({
      topic: String(item.topic || item.name || `topic_${index + 1}`),
      score: Number(item.score_percent ?? item.score ?? 0)
    }));
  }, [scopeDashboardQuery.data?.weak_topics]);

  return (
    <AppShell>
      <section className="content-stack">
        <Card>
          <Card.Header>
            <h2>Teacher Analytics</h2>
          </Card.Header>
          <Card.Body className="content-stack">
            <section className="filter-form">
              <Select
                label="Период"
                value={period}
                onChange={(event) => setPeriod(event.target.value as PeriodKey)}
                options={PERIOD_OPTIONS}
              />
              <Select
                label="Класс"
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                options={[
                  { value: "all", label: "all" },
                  ...teacherClasses.map((item) => ({ value: item.class_id, label: `${item.class_name} (${item.class_id})` }))
                ]}
              />
            </section>

            {scopeDashboardQuery.data ? (
              <section className="panel-grid">
                <Stat label="Class Average" value={`${scopeDashboardQuery.data.class_average}%`} />
                <Stat label="Completed Sessions" value={scopeDashboardQuery.data.completed_sessions} />
                <Stat label="Weak Topics" value={scopeDashboardQuery.data.weak_topics.length} />
                <Stat label="Snapshot" value={new Date(scopeDashboardQuery.data.snapshot_updated_at).toLocaleTimeString()} />
              </section>
            ) : (
              <EmptyState
                title={scopeDashboardQuery.isLoading ? "Загрузка аналитики..." : "Нет данных"}
                description="Пока нет данных для выбранного периода/класса."
              />
            )}
          </Card.Body>
        </Card>

        <section className="panel-grid analytics-grid">
          <Card>
            <Card.Header>
              <h3>Динамика по периодам</h3>
            </Card.Header>
            <Card.Body>
              {periodTrendQuery.data?.length ? (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={periodTrendQuery.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="class_average" stroke="#1e40af" strokeWidth={2} name="Avg score %" />
                      <Line type="monotone" dataKey="completed_sessions" stroke="#0f766e" strokeWidth={2} name="Completed sessions" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Нет данных тренда" />
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h3>Сравнение по классам</h3>
            </Card.Header>
            <Card.Body>
              {classComparisonQuery.data?.length ? (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={classComparisonQuery.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="className" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="class_average" fill="#1e40af" radius={[6, 6, 0, 0]} name="Avg score %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Нет данных по классам" description="Привяжите классы к преподавателю для сравнения." />
              )}
            </Card.Body>
          </Card>
        </section>

        <Card>
          <Card.Header>
            <h3>Слабые темы</h3>
          </Card.Header>
          <Card.Body>
            {weakTopics.length ? (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={weakTopics} layout="vertical" margin={{ left: 16, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" />
                    <YAxis dataKey="topic" type="category" width={120} />
                    <Tooltip />
                    <Bar dataKey="score" fill="#92400e" radius={[0, 6, 6, 0]} name="Score %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="Weak topics отсутствуют" description="API не вернул слабые темы для текущего фильтра." />
            )}
          </Card.Body>
        </Card>
      </section>
    </AppShell>
  );
}
