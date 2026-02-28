import { useMemo, useState } from "react";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Table, type TableColumn } from "../components/ui/Table";

type JobStatus = "pending" | "running" | "completed" | "failed";

interface JobTemplate {
  id: string;
  title: string;
  description: string;
  lastRun: string;
  status: JobStatus;
  duration: string;
}

interface JobHistoryRow {
  id: string;
  job: string;
  startedBy: string;
  startedAt: string;
  endedAt: string;
  status: JobStatus;
  log: string;
}

const JOBS: JobTemplate[] = [
  { id: "scrape", title: "Scrape", description: "Обновление данных", lastRun: "2026-02-28 12:20", status: "completed", duration: "2m 14s" },
  { id: "reindex", title: "Re-index", description: "Переиндексация поиска", lastRun: "2026-02-28 10:11", status: "completed", duration: "4m 41s" },
  { id: "quality", title: "Quality", description: "Проверка качества", lastRun: "2026-02-28 11:37", status: "pending", duration: "-" },
  { id: "finalize", title: "Finalize", description: "Закрытие сессий", lastRun: "2026-02-28 12:36", status: "completed", duration: "58s" }
];

const HISTORY: JobHistoryRow[] = [
  {
    id: "h1",
    job: "Scrape",
    startedBy: "admin",
    startedAt: "2026-02-28 12:18",
    endedAt: "2026-02-28 12:20",
    status: "completed",
    log: "[INFO] start\n[INFO] processed=31\n[INFO] completed"
  },
  {
    id: "h2",
    job: "Finalize",
    startedBy: "cron",
    startedAt: "2026-02-28 12:35",
    endedAt: "2026-02-28 12:36",
    status: "completed",
    log: "[INFO] start\n[INFO] finalized_sessions=5\n[INFO] completed"
  }
];

export function AdminJobsPage() {
  const [history] = useState(HISTORY);
  const [openLogId, setOpenLogId] = useState<string | null>(null);

  const historyColumns: TableColumn<JobHistoryRow>[] = useMemo(
    () => [
      { id: "job", header: "Задача", sortable: true, accessor: (row) => row.job, render: (row) => row.job },
      { id: "startedBy", header: "Запустил", sortable: true, accessor: (row) => row.startedBy, render: (row) => row.startedBy },
      { id: "start", header: "Начало", sortable: true, accessor: (row) => row.startedAt, render: (row) => row.startedAt },
      { id: "end", header: "Конец", sortable: true, accessor: (row) => row.endedAt, render: (row) => row.endedAt },
      {
        id: "status",
        header: "Статус",
        sortable: true,
        accessor: (row) => row.status,
        render: (row) => (
          <Badge variant={row.status === "completed" ? "success" : row.status === "failed" ? "danger" : "warning"}>{row.status}</Badge>
        )
      },
      {
        id: "log",
        header: "Лог",
        render: (row) => (
          <Button size="sm" variant="ghost" onClick={() => setOpenLogId(row.id)}>
            Открыть лог
          </Button>
        )
      }
    ],
    []
  );

  const activeLog = history.find((item) => item.id === openLogId) || null;

  return (
    <AdminLayout title="Jobs" subtitle="Запуск и аудит фоновых задач">
      <Card>
        <Card.Header>
          <h3>Запустить задачу</h3>
        </Card.Header>
        <Card.Body>
          <section className="admin-job-grid">
            {JOBS.map((job) => (
              <Card key={job.id} variant="flat">
                <Card.Body className="content-stack">
                  <div className="admin-job-head">
                    <strong>{job.title}</strong>
                    <Badge variant={job.status === "completed" ? "success" : "warning"}>{job.status}</Badge>
                  </div>
                  <p className="panel-note">{job.description}</p>
                  <p className="panel-note">Последний запуск: {job.lastRun}</p>
                  <p className="panel-note">Длительность: {job.duration}</p>
                  <Button variant="secondary">Запустить сейчас</Button>
                </Card.Body>
              </Card>
            ))}
          </section>
        </Card.Body>
      </Card>

      <Card className="table-panel">
        <Card.Header>
          <h3>История</h3>
        </Card.Header>
        <Table columns={historyColumns} rows={history} rowKey={(row) => row.id} />
      </Card>

      <Modal
        open={Boolean(activeLog)}
        onOpenChange={(open) => {
          if (!open) {
            setOpenLogId(null);
          }
        }}
        title={activeLog ? `Лог: ${activeLog.job}` : "Лог"}
        footer={
          <Button variant="secondary" onClick={() => setOpenLogId(null)}>
            Закрыть
          </Button>
        }
      >
        <pre className="admin-log-view">{activeLog?.log || ""}</pre>
      </Modal>
    </AdminLayout>
  );
}
