import { useMemo, useState } from "react";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/FormFields";
import { Modal } from "../components/ui/Modal";
import { Table, type TableColumn } from "../components/ui/Table";

interface SchoolRow {
  id: string;
  name: string;
  city: string;
  teachers: number;
  students: number;
  status: "active" | "paused";
  createdAt: string;
}

const INITIAL_SCHOOLS: SchoolRow[] = [
  { id: "sch_01", name: "School A", city: "Tashkent", teachers: 42, students: 781, status: "active", createdAt: "2025-08-12" },
  { id: "sch_02", name: "School B", city: "Samarkand", teachers: 35, students: 620, status: "active", createdAt: "2025-07-02" },
  { id: "sch_03", name: "School C", city: "Bukhara", teachers: 18, students: 302, status: "paused", createdAt: "2024-11-15" }
];

export function AdminSchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>(INITIAL_SCHOOLS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formDirectorEmail, setFormDirectorEmail] = useState("");

  const filtered = useMemo(
    () =>
      schools.filter((school) => {
        if (statusFilter !== "all" && school.status !== statusFilter) {
          return false;
        }
        if (!search.trim()) {
          return true;
        }
        const q = search.toLowerCase();
        return school.name.toLowerCase().includes(q) || school.city.toLowerCase().includes(q);
      }),
    [schools, search, statusFilter]
  );

  const columns: TableColumn<SchoolRow>[] = [
    { id: "name", header: "Название", sortable: true, accessor: (row) => row.name, render: (row) => row.name },
    { id: "city", header: "Город", sortable: true, accessor: (row) => row.city, render: (row) => row.city },
    { id: "teachers", header: "Учителей", sortable: true, accessor: (row) => row.teachers, render: (row) => row.teachers },
    { id: "students", header: "Учеников", sortable: true, accessor: (row) => row.students, render: (row) => row.students },
    {
      id: "status",
      header: "Статус",
      sortable: true,
      accessor: (row) => row.status,
      render: (row) => <Badge variant={row.status === "active" ? "success" : "warning"}>{row.status}</Badge>
    },
    { id: "created", header: "Дата создания", sortable: true, accessor: (row) => row.createdAt, render: (row) => row.createdAt },
    {
      id: "actions",
      header: "Действия",
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => setSelectedSchool(row)}>
          Открыть
        </Button>
      )
    }
  ];

  function createSchool() {
    if (!formName.trim() || !formCity.trim()) {
      return;
    }
    setSchools((current) => [
      {
        id: `sch_${Date.now()}`,
        name: formName.trim(),
        city: formCity.trim(),
        teachers: 0,
        students: 0,
        status: "active",
        createdAt: new Date().toISOString().slice(0, 10)
      },
      ...current
    ]);
    setFormName("");
    setFormCity("");
    setFormDirectorEmail("");
    setOpenCreate(false);
  }

  return (
    <AdminLayout title="Школы" subtitle="Управление школами и их базовой конфигурацией">
      <Card>
        <Card.Body className="content-stack">
          <section className="filter-form">
            <Input label="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название или город" />
            <Select
              label="Статус"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "paused")}
              options={[
                { value: "all", label: "all" },
                { value: "active", label: "active" },
                { value: "paused", label: "paused" }
              ]}
            />
          </section>
          <div className="row-actions">
            <Button onClick={() => setOpenCreate(true)}>Добавить школу</Button>
          </div>
        </Card.Body>
      </Card>

      <Card className="table-panel">
        <Table columns={columns} rows={filtered} rowKey={(row) => row.id} />
      </Card>

      <Modal
        open={openCreate}
        onOpenChange={setOpenCreate}
        title="Новая школа"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpenCreate(false)}>
              Отмена
            </Button>
            <Button onClick={createSchool}>Создать</Button>
          </>
        }
      >
        <div className="content-stack">
          <Input label="Название" value={formName} onChange={(event) => setFormName(event.target.value)} />
          <Input label="Город" value={formCity} onChange={(event) => setFormCity(event.target.value)} />
          <Input
            label="Email директора"
            value={formDirectorEmail}
            onChange={(event) => setFormDirectorEmail(event.target.value)}
            placeholder="director@school.org"
          />
          <p className="panel-note">После создания будет автоматически сгенерирован invite для директора.</p>
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedSchool)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSchool(null);
          }
        }}
        title={selectedSchool ? `Школа: ${selectedSchool.name}` : "Школа"}
        footer={
          <Button variant="secondary" onClick={() => setSelectedSchool(null)}>
            Закрыть
          </Button>
        }
      >
        {selectedSchool ? (
          <div className="content-stack">
            <p className="panel-note">Обзор</p>
            <div className="metrics-row">
              <span>Учителей: {selectedSchool.teachers}</span>
              <span>Учеников: {selectedSchool.students}</span>
              <span>Статус: {selectedSchool.status}</span>
            </div>
            <p className="panel-note">Пользователи, тесты и настройки доступны в отдельных вкладках следующего итерационного шага.</p>
          </div>
        ) : null}
      </Modal>
    </AdminLayout>
  );
}
