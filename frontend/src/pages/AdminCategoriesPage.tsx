import { useState } from "react";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/FormFields";
import { Table, type TableColumn } from "../components/ui/Table";

interface CategoryRow {
  id: string;
  name: string;
  tests: number;
  updatedAt: string;
}

const INITIAL_CATEGORIES: CategoryRow[] = [
  { id: "c1", name: "Алгебра", tests: 28, updatedAt: "2026-02-22" },
  { id: "c2", name: "Геометрия", tests: 16, updatedAt: "2026-02-19" },
  { id: "c3", name: "Физика", tests: 34, updatedAt: "2026-02-20" }
];

export function AdminCategoriesPage() {
  const [rows, setRows] = useState(INITIAL_CATEGORIES);
  const [newName, setNewName] = useState("");

  const columns: TableColumn<CategoryRow>[] = [
    { id: "name", header: "Категория", sortable: true, accessor: (row) => row.name, render: (row) => row.name },
    { id: "tests", header: "Тестов", sortable: true, accessor: (row) => row.tests, render: (row) => row.tests },
    { id: "updated", header: "Обновлено", sortable: true, accessor: (row) => row.updatedAt, render: (row) => row.updatedAt }
  ];

  return (
    <AdminLayout title="Категории" subtitle="Управление классификацией тестов">
      <Card>
        <Card.Body className="row-actions">
          <Input label="Новая категория" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <Button
            onClick={() => {
              if (!newName.trim()) {
                return;
              }
              setRows((current) => [
                {
                  id: `c_${Date.now()}`,
                  name: newName.trim(),
                  tests: 0,
                  updatedAt: new Date().toISOString().slice(0, 10)
                },
                ...current
              ]);
              setNewName("");
            }}
          >
            Добавить
          </Button>
        </Card.Body>
      </Card>
      <Card className="table-panel">
        <Table columns={columns} rows={rows} rowKey={(row) => row.id} />
      </Card>
    </AdminLayout>
  );
}
