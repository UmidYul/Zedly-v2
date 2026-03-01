import { useMemo } from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Table, type TableColumn } from "../ui/Table";
import type { ClassResultStudentRow } from "../../lib/api";

interface ResultsTableProps {
  rows: ClassResultStudentRow[];
  loading?: boolean;
  onRemind: (studentId: string) => void;
}

function statusBadge(status: string) {
  if (status === "completed") {
    return <Badge variant="success">Завершён</Badge>;
  }
  if (status === "in_progress") {
    return <Badge variant="info">В процессе</Badge>;
  }
  if (status === "overdue") {
    return <Badge variant="warning">Просрочил</Badge>;
  }
  return <Badge variant="outline">Не начал</Badge>;
}

export function ResultsTable({ rows, loading = false, onRemind }: ResultsTableProps) {
  const sorted = useMemo(
    () => [...rows].sort((left, right) => (right.score_percent || -1) - (left.score_percent || -1)),
    [rows]
  );

  const columns: TableColumn<ClassResultStudentRow>[] = [
    {
      id: "student",
      header: "Ученик",
      sortable: true,
      accessor: (row) => row.student_name,
      render: (row) => row.student_name
    },
    {
      id: "score",
      header: "Балл",
      sortable: true,
      accessor: (row) => row.score_percent ?? -1,
      render: (row) => (row.score_percent === null ? "—" : `${row.score_percent}%`)
    },
    {
      id: "correct",
      header: "Правильных",
      sortable: true,
      accessor: (row) => row.correct_answers,
      render: (row) => (row.status === "completed" ? `${row.correct_answers}/${row.total_questions}` : "—")
    },
    {
      id: "time",
      header: "Время",
      render: (row) => (row.completed_at ? new Date(row.completed_at).toLocaleTimeString("ru-RU") : "—")
    },
    {
      id: "status",
      header: "Статус",
      sortable: true,
      accessor: (row) => row.status,
      render: (row) => statusBadge(row.status)
    },
    {
      id: "actions",
      header: "Действия",
      render: (row) =>
        row.status === "not_started" ? (
          <Button size="sm" variant="secondary" onClick={() => onRemind(row.student_id)}>
            Напомнить
          </Button>
        ) : (
          <span className="panel-note">Разбор</span>
        )
    }
  ];

  return (
    <Table
      columns={columns}
      rows={sorted}
      loading={loading}
      rowKey={(row) => row.student_id}
      pageSize={12}
      emptyTitle="Ни один ученик ещё не прошёл тест"
      emptyDescription="Результаты появятся после первых завершений."
    />
  );
}
