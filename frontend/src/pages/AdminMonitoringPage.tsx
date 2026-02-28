import { Activity } from "lucide-react";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { ProgressBar } from "../components/ui/ProgressBar";

const SERVICES = [
  { name: "API Server", detail: "Uptime: 99.8% • Resp: 45ms", status: "Online", metric: 92 },
  { name: "Database", detail: "Connections: 12/50", status: "Online", metric: 64 },
  { name: "Redis Cache", detail: "Memory: 24/256MB", status: "Online", metric: 24 },
  { name: "Job Queue", detail: "Pending: 3 • Failed: 0", status: "Online", metric: 33 }
];

export function AdminMonitoringPage() {
  return (
    <AdminLayout title="Мониторинг" subtitle="Состояние сервисов и нагрузка системы">
      <Card>
        <Card.Header>
          <h3>Сервисы</h3>
        </Card.Header>
        <Card.Body className="content-stack">
          {SERVICES.map((service) => (
            <div key={service.name} className="monitoring-service-row">
              <div>
                <strong>{service.name}</strong>
                <p className="panel-note">{service.detail}</p>
              </div>
              <Badge variant="success">{service.status}</Badge>
            </div>
          ))}
        </Card.Body>
      </Card>

      <section className="panel-grid">
        <Card>
          <Card.Header>
            <h3>
              <Activity size={16} /> API req/s (последний час)
            </h3>
          </Card.Header>
          <Card.Body className="content-stack">
            <ProgressBar value={72} labeled />
            <p className="panel-note">Peak: 124 req/s • Current: 71 req/s</p>
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>
            <h3>Время ответа БД (ms)</h3>
          </Card.Header>
          <Card.Body className="content-stack">
            <ProgressBar value={38} labeled />
            <p className="panel-note">P95: 29ms • Current: 16ms</p>
          </Card.Body>
        </Card>
      </section>
    </AdminLayout>
  );
}
