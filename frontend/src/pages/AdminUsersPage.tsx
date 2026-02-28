import { useMemo, useState } from "react";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/FormFields";
import { Table, type TableColumn } from "../components/ui/Table";

interface AdminUserRow {
  id: string;
  fullName: string;
  role: "director" | "teacher" | "student";
  school: string;
  status: "active" | "inactive";
}

const INITIAL_USERS: AdminUserRow[] = [
  { id: "u1", fullName: "Alice Director", role: "director", school: "School A", status: "active" },
  { id: "u2", fullName: "Tom Teacher", role: "teacher", school: "School B", status: "active" },
  { id: "u3", fullName: "Sam Student", role: "student", school: "School A", status: "inactive" }
];

export function AdminUsersPage() {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("all");
  const [role, setRole] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(
    () =>
      users.filter((user) => {
        if (school !== "all" && user.school !== school) {
          return false;
        }
        if (role !== "all" && user.role !== role) {
          return false;
        }
        if (!search.trim()) {
          return true;
        }
        const q = search.toLowerCase();
        return user.fullName.toLowerCase().includes(q);
      }),
    [users, school, role, search]
  );

  const columns: TableColumn<AdminUserRow>[] = [
    { id: "name", header: "Пользователь", sortable: true, accessor: (row) => row.fullName, render: (row) => row.fullName },
    { id: "role", header: "Роль", sortable: true, accessor: (row) => row.role, render: (row) => <Badge variant="outline">{row.role}</Badge> },
    { id: "school", header: "Школа", sortable: true, accessor: (row) => row.school, render: (row) => row.school },
    {
      id: "status",
      header: "Статус",
      sortable: true,
      accessor: (row) => row.status,
      render: (row) => <Badge variant={row.status === "active" ? "success" : "warning"}>{row.status}</Badge>
    },
    {
      id: "actions",
      header: "Действия",
      render: (row) => (
        <div className="row-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setUsers((current) =>
                current.map((item) =>
                  item.id === row.id ? { ...item, status: item.status === "active" ? "inactive" : "active" } : item
                )
              )
            }
          >
            Сменить статус
          </Button>
          <Button variant="ghost" size="sm">
            Logout
          </Button>
        </div>
      )
    }
  ];

  return (
    <AdminLayout title="Пользователи платформы" subtitle="Глобальный список пользователей всех школ">
      <Card>
        <Card.Body className="content-stack">
          <section className="filter-form">
            <Input label="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя" />
            <Select
              label="Школа"
              value={school}
              onChange={(event) => setSchool(event.target.value)}
              options={[
                { value: "all", label: "all" },
                { value: "School A", label: "School A" },
                { value: "School B", label: "School B" }
              ]}
            />
            <Select
              label="Роль"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              options={[
                { value: "all", label: "all" },
                { value: "director", label: "director" },
                { value: "teacher", label: "teacher" },
                { value: "student", label: "student" }
              ]}
            />
          </section>
          {selected.length ? (
            <div className="row-actions">
              <Badge variant="info">Выбрано: {selected.length}</Badge>
              <Button variant="secondary" size="sm">
                Принудительный logout
              </Button>
              <Button variant="danger" size="sm">
                Удалить
              </Button>
            </div>
          ) : null}
        </Card.Body>
      </Card>

      <Card className="table-panel">
        <Table
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          enableSelection
          selectedRowKeys={selected}
          onSelectedRowKeysChange={setSelected}
        />
      </Card>
    </AdminLayout>
  );
}
