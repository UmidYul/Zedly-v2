import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Stat } from "../components/ui/Stat";

type JobStatus = "pending" | "running" | "completed" | "failed";

interface JobCardState {
  id: string;
  title: string;
  description: string;
  lastRunAgo: string;
  status: JobStatus;
}

const INITIAL_JOBS: JobCardState[] = [
  { id: "scrape", title: "Scrape", description: "Сбор данных из внешних источников", lastRunAgo: "10 мин назад", status: "completed" },
  { id: "reindex", title: "Re-index", description: "Переиндексация базы контента", lastRunAgo: "2 часа назад", status: "completed" },
  { id: "quality", title: "Quality", description: "Проверка качества данных", lastRunAgo: "35 мин назад", status: "pending" },
  { id: "finalize", title: "Finalize", description: "Финализация истёкших сессий", lastRunAgo: "6 мин назад", status: "completed" }
];

export function AdminHubPage() {
  const [metricsTick, setMetricsTick] = useState(0);
  const [jobs, setJobs] = useState<JobCardState[]>(INITIAL_JOBS);
  const [alerts, setAlerts] = useState([
    { id: "a1", priority: "critical", text: "5 истёкших сессий не финализированы", time: "12:41" },
    { id: "a2", priority: "warning", text: "API rate limit 80% использован", time: "12:38" },
    { id: "a3", priority: "info", text: "Очередь заданий стабилизирована", time: "12:27" }
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => setMetricsTick((prev) => prev + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const runningJobs = jobs.filter((job) => job.status === "running");
    if (!runningJobs.length) {
      return;
    }
    const timer = window.setInterval(() => {
      setJobs((current) =>
        current.map((job) => {
          if (job.status !== "running") {
            return job;
          }
          const failed = Math.random() < 0.12;
          return {
            ...job,
            status: failed ? "failed" : "completed",
            lastRunAgo: "только что"
          };
        })
      );
    }, 5000);
    return () => window.clearInterval(timer);
  }, [jobs]);

  const sampledMetrics = useMemo(
    () => ({
      apiOk: true,
      dbMs: 12 + (metricsTick % 5),
      queue: 3 + (metricsTick % 4),
      sessions: 47 + (metricsTick % 9)
    }),
    [metricsTick]
  );

  function runJob(jobId: string) {
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "running",
              lastRunAgo: "запущено"
            }
          : job
      )
    );
  }

  function dismissAlert(alertId: string) {
    setAlerts((current) => current.filter((item) => item.id !== alertId));
  }

  return (
    <AdminLayout title="Admin Hub" subtitle="Оперативная панель состояния платформы">
      <Card>
        <Card.Body>
          <div className="admin-health-row">
            <span>
              Статус API:{" "}
              <Badge variant={sampledMetrics.apiOk ? "success" : "danger"}>
                {sampledMetrics.apiOk ? "OK" : "DOWN"}
              </Badge>
            </span>
            <span>БД: {sampledMetrics.dbMs}ms</span>
            <span>Очередь: {sampledMetrics.queue} задач</span>
            <span>Активных сессий: {sampledMetrics.sessions}</span>
          </div>
        </Card.Body>
      </Card>

      <section className="panel-grid admin-kpi-grid">
        <Stat label="Всего школ" value={146} delta={2} />
        <Stat label="Активных пользователей" value={9128} delta={3} />
        <Stat label="Тестов за 24ч" value={683} delta={4} />
        <Stat label="Сессий за 24ч" value={2281} delta={5} />
      </section>

      <Card>
        <Card.Header>
          <h3>Фоновые задачи</h3>
        </Card.Header>
        <Card.Body className="content-stack">
          <div className="row-actions">
            <Button variant="secondary">
              <RefreshCw size={14} /> Обновить
            </Button>
          </div>
          <section className="admin-job-grid">
            {jobs.map((job) => (
              <Card key={job.id} variant="flat">
                <Card.Body className="content-stack">
                  <div className="admin-job-head">
                    <strong>{job.title}</strong>
                    <Badge
                      variant={
                        job.status === "completed"
                          ? "success"
                          : job.status === "running"
                            ? "info"
                            : job.status === "failed"
                              ? "danger"
                              : "warning"
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>
                  <p className="panel-note">{job.description}</p>
                  <p className="panel-note">Последний запуск: {job.lastRunAgo}</p>
                  <Button variant="secondary" loading={job.status === "running"} onClick={() => runJob(job.id)}>
                    {job.status === "running" ? "Running..." : "Запустить"}
                  </Button>
                </Card.Body>
              </Card>
            ))}
          </section>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <h3>Системные алерты</h3>
        </Card.Header>
        <Card.Body className="content-stack">
          {alerts.length ? (
            alerts.map((alert) => (
              <Alert
                key={alert.id}
                variant={alert.priority === "critical" ? "danger" : alert.priority === "warning" ? "warning" : "info"}
                title={alert.text}
                message={`Время: ${alert.time}`}
                onDismiss={() => dismissAlert(alert.id)}
              />
            ))
          ) : (
            <Alert variant="success" title="Активных системных алертов нет" message="Система работает стабильно." />
          )}
          <div className="row-actions">
            <Badge variant="danger">
              <AlertTriangle size={12} /> Critical: {alerts.filter((item) => item.priority === "critical").length}
            </Badge>
            <Badge variant="warning">
              <TriangleAlert size={12} /> Warning: {alerts.filter((item) => item.priority === "warning").length}
            </Badge>
            <Badge variant="success">
              <CheckCircle2 size={12} /> Info: {alerts.filter((item) => item.priority === "info").length}
            </Badge>
          </div>
        </Card.Body>
      </Card>
    </AdminLayout>
  );
}
