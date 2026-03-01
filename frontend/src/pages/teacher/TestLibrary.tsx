import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { AssignModal } from "../../components/teacher/AssignModal";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input, Select } from "../../components/ui/FormFields";
import { MARKETPLACE_TESTS } from "../../mockData/marketplace";
import { testsList, usersMe, type TeacherClassRef, type TeacherLibraryTest } from "../../lib/api";
import { useAuth } from "../../state/auth-context";
import { useToastStore } from "../../state/toast-store";
import type { TeacherClassInfo } from "../../types/teacher";

function statusBadge(status: string) {
  if (status === "published") {
    return <Badge variant="info">Опубликован</Badge>;
  }
  if (status === "archived") {
    return <Badge variant="outline">Архив</Badge>;
  }
  return <Badge variant="outline">Черновик</Badge>;
}

function normalizeClasses(input: TeacherClassRef[] = []): TeacherClassInfo[] {
  return input.map((item, index) => ({
    id: String(item.id || item.class_id || `class_${index + 1}`),
    name: String(item.name || item.class_name || item.class_id || `Класс ${index + 1}`),
    studentsCount: Number(item.students_count || 0),
    lastActivity: String(item.last_activity || "сегодня")
  }));
}

export function TestLibraryPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const pushToast = useToastStore((state) => state.pushToast);

  const [tab, setTab] = useState<"mine" | "marketplace">("mine");
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignTarget, setAssignTarget] = useState<TeacherLibraryTest | null>(null);
  const [copiedTests, setCopiedTests] = useState<TeacherLibraryTest[]>([]);

  const accessToken = session?.tokens.access_token || "";

  const meQuery = useQuery({
    queryKey: ["teacher", "library", "me"],
    enabled: Boolean(session),
    queryFn: () => usersMe(accessToken)
  });

  const testsQuery = useQuery({
    queryKey: ["teacher", "library", "tests"],
    enabled: Boolean(session),
    queryFn: () => testsList(accessToken)
  });

  const classes = useMemo(
    () => normalizeClasses((meQuery.data?.teacher_classes || []) as TeacherClassRef[]),
    [meQuery.data?.teacher_classes]
  );

  const myTests = useMemo(() => {
    const list = [...(testsQuery.data || []), ...copiedTests];
    return list.filter((item) => {
      if (subjectFilter !== "all" && item.subject !== subjectFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (search && !`${item.title} ${item.subject}`.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [copiedTests, search, statusFilter, subjectFilter, testsQuery.data]);

  const marketplace = useMemo(() => {
    return MARKETPLACE_TESTS.filter((item) => {
      if (subjectFilter !== "all" && item.subject !== subjectFilter) {
        return false;
      }
      if (search && !`${item.title} ${item.subject}`.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [search, subjectFilter]);

  if (!session) {
    return null;
  }

  return (
    <AppShell>
      <section className="content-stack">
        <Card>
          <Card.Body>
            <div className="teacher-tabs-row">
              <button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")} type="button">
                Мои тесты
              </button>
              <button className={tab === "marketplace" ? "active" : ""} onClick={() => setTab("marketplace")} type="button">
                Marketplace
              </button>
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Body className="teacher-filter-row">
            <Input label="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="По названию или теме" />
            <Select
              label="Предмет"
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              options={[
                { value: "all", label: "Все" },
                ...Array.from(new Set([...(testsQuery.data || []).map((item) => item.subject), ...MARKETPLACE_TESTS.map((item) => item.subject)])).map(
                  (subject) => ({
                    value: subject,
                    label: subject
                  })
                )
              ]}
            />
            {tab === "mine" ? (
              <Select
                label="Статус"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                options={[
                  { value: "all", label: "Все" },
                  { value: "draft", label: "Черновик" },
                  { value: "published", label: "Опубликован" },
                  { value: "archived", label: "Архив" }
                ]}
              />
            ) : null}
            <Button onClick={() => navigate("/tests/new")}>+ Создать тест</Button>
          </Card.Body>
        </Card>

        {tab === "mine" ? (
          <section className="teacher-library-list">
            {myTests.map((item) => (
              <Card key={item.id}>
                <Card.Body className="teacher-library-row">
                  <div>
                    <h3>{item.title}</h3>
                    <p className="panel-note">
                      {statusBadge(item.status)} {item.subject} · {item.questions_count} вопросов · {item.time_limit_minutes || "—"} мин
                    </p>
                  </div>
                  <div className="teacher-library-actions">
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/tests/${item.id}/edit`)}>
                      ✏️
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setAssignTarget(item)}>
                      📋
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/results/${item.id}`)}>
                      📊
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            ))}

            {myTests.length === 0 ? (
              <EmptyState title="У вас пока нет тестов" description="Создайте первый тест и назначьте классу." actionLabel="Создать тест" onAction={() => navigate("/tests/new")} />
            ) : null}
          </section>
        ) : (
          <section className="teacher-library-list">
            {marketplace.map((item) => (
              <Card key={item.id}>
                <Card.Body className="content-stack">
                  <div>
                    <h3>
                      {item.title} ★ {item.rating} ({item.ratingCount})
                    </h3>
                    <p className="panel-note">Автор: {item.authorName} · {item.subject} · {item.gradeLabel}</p>
                    <p className="panel-note">
                      {item.questionsCount} вопросов · {item.durationMinutes} мин · 🔁 {item.usageCount} использований
                    </p>
                  </div>
                  <div className="teacher-marketplace-actions">
                    <Button size="sm" variant="secondary">
                      Предпросмотр
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const copy: TeacherLibraryTest = {
                          id: `copy_${item.id}_${Date.now()}`,
                          title: item.title,
                          subject: item.subject,
                          status: "draft",
                          questions_count: item.questionsCount,
                          time_limit_minutes: item.durationMinutes
                        };
                        setCopiedTests((prev) => [copy, ...prev]);
                        pushToast({
                          type: "success",
                          title: "Тест скопирован",
                          message: "Тест добавлен в вашу библиотеку"
                        });
                        setTab("mine");
                      }}
                    >
                      Добавить в мои тесты
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </section>
        )}
      </section>

      <AssignModal
        testId={assignTarget?.id || ""}
        testTitle={assignTarget?.title || ""}
        classes={classes}
        isOpen={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        onSuccess={() => {
          if (assignTarget) {
            navigate(`/results/${assignTarget.id}?class_id=${classes[0]?.id || ""}`);
          }
        }}
      />
    </AppShell>
  );
}
