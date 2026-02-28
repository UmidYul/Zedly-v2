import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/FormFields";
import { Modal } from "../components/ui/Modal";
import { Table, type TableColumn } from "../components/ui/Table";

type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

interface LogRow {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  user: string;
}

const INITIAL_LOGS: LogRow[] = [
  { id: "l1", timestamp: "2026-02-28 12:33:02", level: "INFO", service: "api", message: "GET /analytics 200", user: "teacher.a" },
  { id: "l2", timestamp: "2026-02-28 12:33:15", level: "WARNING", service: "queue", message: "Worker lag above threshold", user: "-" },
  { id: "l3", timestamp: "2026-02-28 12:33:38", level: "ERROR", service: "db", message: "Timeout on reporting query", user: "director.b" }
];

export function AdminLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>(INITIAL_LOGS);
  const [level, setLevel] = useState<"all" | LogLevel>("all");
  const [service, setService] = useState("all");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogRow | null>(null);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const timer = window.setInterval(() => {
      setLogs((current) => [
        {
          id: `l_${Date.now()}`,
          timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
          level: "INFO",
          service: "api",
          message: "Heartbeat OK",
          user: "-"
        },
        ...current
      ]);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  const filtered = useMemo(
    () =>
      logs.filter((log) => {
        if (level !== "all" && log.level !== level) {
          return false;
        }
        if (service !== "all" && log.service !== service) {
          return false;
        }
        if (!search.trim()) {
          return true;
        }
        return `${log.message} ${log.user}`.toLowerCase().includes(search.toLowerCase());
      }),
    [logs, level, service, search]
  );

  const columns: TableColumn<LogRow>[] = [
    { id: "time", header: "Время", sortable: true, accessor: (row) => row.timestamp, render: (row) => row.timestamp },
    {
      id: "level",
      header: "Уровень",
      sortable: true,
      accessor: (row) => row.level,
      render: (row) => (
        <Badge
          variant={
            row.level === "ERROR" || row.level === "CRITICAL" ? "danger" : row.level === "WARNING" ? "warning" : "info"
          }
        >
          {row.level}
        </Badge>
      )
    },
    { id: "service", header: "Сервис", sortable: true, accessor: (row) => row.service, render: (row) => row.service },
    { id: "message", header: "Сообщение", sortable: true, accessor: (row) => row.message, render: (row) => row.message },
    { id: "user", header: "Пользователь", sortable: true, accessor: (row) => row.user, render: (row) => row.user },
    {
      id: "detail",
      header: "Детали",
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(row)}>
          Открыть
        </Button>
      )
    }
  ];

  return (
    <AdminLayout title="Системные логи" subtitle="Централизованный журнал событий платформы">
      <Card>
        <Card.Body className="content-stack">
          <section className="filter-form">
            <Select
              label="Уровень"
              value={level}
              onChange={(event) => setLevel(event.target.value as "all" | LogLevel)}
              options={[
                { value: "all", label: "all" },
                { value: "DEBUG", label: "DEBUG" },
                { value: "INFO", label: "INFO" },
                { value: "WARNING", label: "WARNING" },
                { value: "ERROR", label: "ERROR" },
                { value: "CRITICAL", label: "CRITICAL" }
              ]}
            />
            <Select
              label="Сервис"
              value={service}
              onChange={(event) => setService(event.target.value)}
              options={[
                { value: "all", label: "all" },
                { value: "api", label: "api" },
                { value: "db", label: "db" },
                { value: "queue", label: "queue" }
              ]}
            />
            <Input label="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Текст лога" />
          </section>
          <div className="row-actions">
            <Button variant="secondary" size="sm" onClick={() => setAutoRefresh((prev) => !prev)}>
              Auto-refresh: {autoRefresh ? "on" : "off"}
            </Button>
            <Button size="sm">Экспорт последних 100</Button>
          </div>
        </Card.Body>
      </Card>

      <Card className="table-panel">
        <Table columns={columns} rows={filtered} rowKey={(row) => row.id} />
      </Card>

      <Modal
        open={Boolean(selectedLog)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLog(null);
          }
        }}
        title={selectedLog ? `${selectedLog.level} • ${selectedLog.service}` : "Запись лога"}
        footer={
          <Button variant="secondary" onClick={() => setSelectedLog(null)}>
            Закрыть
          </Button>
        }
      >
        <pre className="admin-log-view">
          {selectedLog
            ? JSON.stringify(
                {
                  timestamp: selectedLog.timestamp,
                  level: selectedLog.level,
                  service: selectedLog.service,
                  message: selectedLog.message,
                  user: selectedLog.user
                },
                null,
                2
              )
            : ""}
        </pre>
      </Modal>
    </AdminLayout>
  );
}
