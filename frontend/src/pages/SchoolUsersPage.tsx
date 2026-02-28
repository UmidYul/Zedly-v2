import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../components/layout/AppShell";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/FormFields";
import { Table, type TableColumn } from "../components/ui/Table";
import { queryKeys } from "../lib/queryKeys";
import type { MeResponse, SchoolUsersQuery } from "../lib/api";
import { usersListSchoolUsers, usersPatchSchoolUser } from "../lib/api";
import { useAuth } from "../state/auth-context";
import { useToastStore } from "../state/toast-store";

export function SchoolUsersPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const pushToast = useToastStore((state) => state.pushToast);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [submittedFilters, setSubmittedFilters] = useState<SchoolUsersQuery>({
    role: "all",
    status: "all"
  });

  const roleOptions = useMemo(() => {
    if (session?.me.role === "teacher") {
      return [
        { value: "all", label: "all" },
        { value: "student", label: "student" }
      ];
    }
    return [
      { value: "all", label: "all" },
      { value: "student", label: "student" },
      { value: "teacher", label: "teacher" },
      { value: "director", label: "director" },
      { value: "psychologist", label: "psychologist" },
      { value: "parent", label: "parent" }
    ];
  }, [session?.me.role]);

  const schoolId = session?.me.school_id;
  const canManageStatuses = session?.me.role === "director";

  const usersQuery = useQuery({
    queryKey: schoolId ? queryKeys.users.school(schoolId, submittedFilters) : queryKeys.users.all,
    queryFn: async () => {
      if (!session || !schoolId) {
        throw new Error("School is not defined");
      }
      return usersListSchoolUsers(session.tokens.access_token, schoolId, submittedFilters);
    },
    enabled: Boolean(session && schoolId)
  });

  const patchStatusMutation = useMutation({
    mutationFn: async ({ userId, nextStatus }: { userId: string; nextStatus: "active" | "inactive" }) => {
      if (!session || !schoolId) {
        throw new Error("School is not defined");
      }
      return usersPatchSchoolUser(session.tokens.access_token, schoolId, userId, nextStatus);
    },
    onSuccess: (_, payload) => {
      pushToast({
        type: "success",
        title: "Статус обновлён",
        message: `Пользователь переведён в "${payload.nextStatus}".`
      });
      if (schoolId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.users.school(schoolId, submittedFilters) });
      }
    }
  });

  const users = usersQuery.data?.users || [];

  const columns: TableColumn<MeResponse>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Пользователь",
        sortable: true,
        accessor: (row) => row.full_name,
        render: (row) => (
          <div className="user-cell">
            <Avatar name={row.full_name} src={row.avatar_url} size="md" />
            <div className="user-cell-meta">
              <strong>{row.full_name}</strong>
              <div>{row.login}</div>
            </div>
          </div>
        )
      },
      {
        id: "role",
        header: "Роль",
        sortable: true,
        accessor: (row) => row.role,
        render: (row) => <Badge variant="outline">{row.role}</Badge>
      },
      {
        id: "email",
        header: "Email",
        sortable: true,
        accessor: (row) => row.email || "",
        render: (row) => row.email || "N/A"
      },
      {
        id: "status",
        header: "Статус",
        sortable: true,
        accessor: (row) => row.status,
        render: (row) => {
          const badgeVariant = row.status === "active" ? "success" : row.status === "inactive" ? "warning" : "default";
          return <Badge variant={badgeVariant}>{row.status}</Badge>;
        }
      },
      {
        id: "actions",
        header: "Действия",
        render: (row) => {
          if (!canManageStatuses || !["teacher", "student", "psychologist", "parent"].includes(row.role)) {
            return "—";
          }
          const activate = row.status !== "active";
          return (
            <Button
              variant="ghost"
              size="sm"
              loading={patchStatusMutation.isPending}
              onClick={() =>
                patchStatusMutation.mutate({
                  userId: row.id,
                  nextStatus: activate ? "active" : "inactive"
                })
              }
            >
              {activate ? "Активировать" : "Деактивировать"}
            </Button>
          );
        }
      }
    ],
    [canManageStatuses, patchStatusMutation]
  );

  function applyFilters() {
    setSubmittedFilters({
      role: role as SchoolUsersQuery["role"],
      status: status as SchoolUsersQuery["status"],
      search: search.trim() || undefined,
      class_id: classId.trim() || undefined
    });
    setSelectedRowKeys([]);
  }

  return (
    <AppShell>
      <section className="content-stack">
        <Card>
          <Card.Header>
            <h2>Управление пользователями</h2>
          </Card.Header>
          <Card.Body className="content-stack">
            <section className="filter-form">
              <Select label="Роль" value={role} onChange={(event) => setRole(event.target.value)} options={roleOptions} />
              <Select
                label="Статус"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                options={[
                  { value: "all", label: "all" },
                  { value: "active", label: "active" },
                  { value: "inactive", label: "inactive" },
                  { value: "pending_approval", label: "pending_approval" }
                ]}
              />
              <Input label="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="name/email" />
              <Input label="Класс" value={classId} onChange={(event) => setClassId(event.target.value)} placeholder="cls_A_7A" />
            </section>

            <div className="row-actions">
              <Button onClick={applyFilters} loading={usersQuery.isFetching}>
                Применить фильтры
              </Button>
              {selectedRowKeys.length ? (
                <>
                  <Badge variant="info" size="md">
                    Выбрано: {selectedRowKeys.length}
                  </Badge>
                  <Button variant="secondary" size="sm">
                    Экспорт
                  </Button>
                </>
              ) : null}
            </div>

            <div className="metrics-row">
              <span>School: {usersQuery.data?.school_id || schoolId || "N/A"}</span>
              <span>Total in scope: {usersQuery.data?.total_in_scope || 0}</span>
              <span>Filtered: {usersQuery.data?.filtered_total || 0}</span>
            </div>
          </Card.Body>
        </Card>

        <Card className="table-panel">
          <Table
            columns={columns}
            rows={users}
            rowKey={(row) => row.id}
            loading={usersQuery.isLoading || usersQuery.isFetching}
            enableSelection
            selectedRowKeys={selectedRowKeys}
            onSelectedRowKeysChange={setSelectedRowKeys}
            emptyTitle="Пользователи не найдены"
            emptyDescription="Проверьте фильтры или измените параметры поиска."
          />
        </Card>
      </section>
    </AppShell>
  );
}
