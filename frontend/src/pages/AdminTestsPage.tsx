import { AdminLayout } from "../components/layout/AdminLayout";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Table, type TableColumn } from "../components/ui/Table";

interface AdminTestRow {
  id: string;
  title: string;
  school: string;
  teacher: string;
  status: "draft" | "published" | "archived";
  createdAt: string;
}

const TESTS: AdminTestRow[] = [
  { id: "t1", title: "Алгебра: квадратные уравнения", school: "School A", teacher: "Tom Teacher", status: "published", createdAt: "2026-02-26" },
  { id: "t2", title: "Геометрия: треугольники", school: "School B", teacher: "Jane Teacher", status: "draft", createdAt: "2026-02-25" },
  { id: "t3", title: "Физика: движение", school: "School A", teacher: "Bill Teacher", status: "archived", createdAt: "2026-02-21" }
];

export function AdminTestsPage() {
  const columns: TableColumn<AdminTestRow>[] = [
    { id: "title", header: "Тест", sortable: true, accessor: (row) => row.title, render: (row) => row.title },
    { id: "school", header: "Школа", sortable: true, accessor: (row) => row.school, render: (row) => row.school },
    { id: "teacher", header: "Учитель", sortable: true, accessor: (row) => row.teacher, render: (row) => row.teacher },
    {
      id: "status",
      header: "Статус",
      sortable: true,
      accessor: (row) => row.status,
      render: (row) => (
        <Badge variant={row.status === "published" ? "success" : row.status === "draft" ? "warning" : "outline"}>{row.status}</Badge>
      )
    },
    { id: "created", header: "Создан", sortable: true, accessor: (row) => row.createdAt, render: (row) => row.createdAt }
  ];

  return (
    <AdminLayout title="Тесты" subtitle="Глобальный контроль тестового контента">
      <Card className="table-panel">
        <Table columns={columns} rows={TESTS} rowKey={(row) => row.id} />
      </Card>
    </AdminLayout>
  );
}
