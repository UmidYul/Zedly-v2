import { useState } from "react";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Checkbox, Input, Select, Textarea } from "../components/ui/FormFields";

export function AdminSettingsPage() {
  const [platformName, setPlatformName] = useState("Zedly");
  const [supportEmail, setSupportEmail] = useState("support@zedly.local");
  const [timezone, setTimezone] = useState("UTC+05:00");
  const [maintenance, setMaintenance] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [saved, setSaved] = useState(false);

  return (
    <AdminLayout title="Настройки системы" subtitle="Глобальные параметры платформы">
      <Card>
        <Card.Body className="content-stack">
          <section className="filter-form">
            <Input label="Название платформы" value={platformName} onChange={(event) => setPlatformName(event.target.value)} />
            <Input label="Support email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} />
            <Select
              label="Часовой пояс"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              options={[
                { value: "UTC+05:00", label: "UTC+05:00" },
                { value: "UTC+00:00", label: "UTC+00:00" },
                { value: "UTC+03:00", label: "UTC+03:00" }
              ]}
            />
          </section>
          <Textarea
            label="Глобальное объявление"
            value={announcement}
            onChange={(event) => setAnnouncement(event.target.value)}
            placeholder="Текст уведомления для всех пользователей"
          />
          <Checkbox label="Maintenance mode" checked={maintenance} onChange={(event) => setMaintenance(event.target.checked)} />
          <div className="row-actions">
            <Button
              onClick={() => {
                setSaved(true);
                window.setTimeout(() => setSaved(false), 2500);
              }}
            >
              Сохранить
            </Button>
          </div>
          {saved ? <Alert variant="success" title="Настройки сохранены" /> : null}
        </Card.Body>
      </Card>
    </AdminLayout>
  );
}
