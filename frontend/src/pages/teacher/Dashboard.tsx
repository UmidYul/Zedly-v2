import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../components/layout/AppShell";
import { ActiveTestsList } from "../../components/teacher/ActiveTestsList";
import { AssignModal } from "../../components/teacher/AssignModal";
import { ClassCards } from "../../components/teacher/ClassCards";
import { EventFeed } from "../../components/teacher/EventFeed";
import { KpiCards } from "../../components/teacher/KpiCards";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { analyticsTeacherDashboardSnapshot, usersMe, type TeacherClassRef } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { useAuth } from "../../state/auth-context";
import type { TeacherActiveTest, TeacherClassInfo, TeacherDashboardViewModel, TeacherEventItem } from "../../types/teacher";

function normalizeClasses(meClasses: TeacherClassRef[] = [], analyticsClasses: Array<Record<string, unknown>> = []): TeacherClassInfo[] {
  const analyticsById = new Map<string, Record<string, unknown>>();
  analyticsClasses.forEach((item) => {
    const id = String(item.id || "");
    if (id) {
      analyticsById.set(id, item);
    }
  });

  return meClasses.map((item, index) => {
    const id = String(item.id || item.class_id || `class_${index + 1}`);
    const analytics = analyticsById.get(id);
    return {
      id,
      name: String(item.name || item.class_name || analytics?.name || id),
      studentsCount: Number(item.students_count || analytics?.students_count || 0),
      lastActivity: String(analytics?.last_activity || item.last_activity || "сегодня")
    };
  });
}

function normalizeActiveTests(raw: Array<Record<string, unknown>> = [], classes: TeacherClassInfo[]): TeacherActiveTest[] {
  return raw.map((item, index) => {
    const classId = String(item.class_id || classes[0]?.id || "");
    const total = Number(item.total_count || item.total || 0);
    const completed = Number(item.completed_count || item.completed || 0);
    const explicitPercent = Number(item.progress_percent || 0);
    const progressPercent = explicitPercent > 0 ? explicitPercent : total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      id: String(item.id || `test_${index + 1}`),
      title: String(item.title || "Тест без названия"),
      classId,
      className: String(item.class_name || classes.find((classItem) => classItem.id === classId)?.name || classId),
      completedCount: completed,
      totalCount: total,
      progressPercent,
      deadlineAt: (item.deadline_at as string | null | undefined) || null,
      startsNow: Boolean(item.starts_now)
    };
  });
}

function normalizeEvents(raw: Array<Record<string, unknown>> = []): TeacherEventItem[] {
  return raw.map((item, index) => ({
    id: `event_${index}_${String(item.timestamp || "")}`,
    type: (String(item.type || "test_completed") as TeacherEventItem["type"]),
    studentName: String(item.student_name || "Ученик"),
    testTitle: item.test_title ? String(item.test_title) : undefined,
    score: typeof item.score === "number" ? item.score : undefined,
    timestamp: String(item.timestamp || new Date().toISOString())
  }));
}

function fallbackViewModel(classes: TeacherClassInfo[]): TeacherDashboardViewModel {
  return {
    kpis: {
      activeTestsCount: 0,
      studentsCompletedToday: 0,
      avgScore7d: 0,
      testsCompletedMonth: 0
    },
    classes,
    activeTests: [],
    events: []
  };
}

export function TeacherDashboardPage() {
  const { session } = useAuth();
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignClassId, setAssignClassId] = useState<string | null>(null);

  const accessToken = session?.tokens.access_token || "";

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    enabled: Boolean(session),
    queryFn: () => usersMe(accessToken)
  });

  const analyticsQuery = useQuery({
    queryKey: queryKeys.teacherDashboard,
    enabled: Boolean(session),
    queryFn: () => analyticsTeacherDashboardSnapshot(accessToken),
    refetchInterval: 60_000
  });

  const eventsQuery = useQuery({
    queryKey: [...queryKeys.teacherDashboard, "events"],
    enabled: Boolean(session),
    queryFn: () => analyticsTeacherDashboardSnapshot(accessToken),
    refetchInterval: 30_000
  });

  const dashboard = useMemo<TeacherDashboardViewModel>(() => {
    const meClasses = (meQuery.data?.teacher_classes || []) as TeacherClassRef[];
    const analyticsClasses = ((analyticsQuery.data?.classes || []) as Array<Record<string, unknown>>) || [];
    const classes = normalizeClasses(meClasses, analyticsClasses);
    if (!analyticsQuery.data) {
      return fallbackViewModel(classes);
    }

    return {
      kpis: {
        activeTestsCount: Number(analyticsQuery.data.active_tests_count || 0),
        studentsCompletedToday: Number(analyticsQuery.data.students_completed_today || 0),
        avgScore7d: Number(analyticsQuery.data.avg_score_7d || 0),
        testsCompletedMonth: Number(analyticsQuery.data.tests_completed_month || 0)
      },
      classes,
      activeTests: normalizeActiveTests((analyticsQuery.data.active_tests || []) as Array<Record<string, unknown>>, classes),
      events: normalizeEvents((eventsQuery.data?.recent_events || analyticsQuery.data.recent_events || []) as Array<Record<string, unknown>>)
    };
  }, [analyticsQuery.data, eventsQuery.data?.recent_events, meQuery.data?.teacher_classes]);

  if (!session) {
    return null;
  }

  return (
    <AppShell>
      <section className="content-stack teacher-dashboard-stack">
        <Card className="teacher-dashboard-hero" variant="elevated">
          <Card.Body>
            <h2>Добро пожаловать, {session.me.full_name}!</h2>
            <p className="panel-note">Всё важное по тестам и классам в одном месте.</p>
            <div className="dashboard-cta-row">
              <Button onClick={() => (window.location.href = "/tests/new")}>Создать тест</Button>
              <Button variant="secondary" onClick={() => setAssignOpen(true)}>
                Назначить тест
              </Button>
              <Button variant="ghost" onClick={() => (window.location.href = "/analytics/results")}>
                Аналитика
              </Button>
            </div>
          </Card.Body>
        </Card>

        {analyticsQuery.isError ? <Alert variant="danger" title="Не удалось загрузить данные" message="Проверьте соединение и попробуйте снова." /> : null}

        <KpiCards data={dashboard.kpis} loading={analyticsQuery.isLoading} />

        <div className="teacher-dashboard-main-grid">
          <div className="teacher-dashboard-left-col">
            <ActiveTestsList tests={dashboard.activeTests} />
            <ClassCards
              classes={dashboard.classes}
              onAssignClick={(classId) => {
                setAssignClassId(classId);
                setAssignOpen(true);
              }}
            />
          </div>

          <EventFeed events={dashboard.events} />
        </div>

        {dashboard.classes.length === 0 ? (
          <EmptyState title="Добро пожаловать!" description="Начните с создания теста и назначения классу." actionLabel="Создать тест" onAction={() => (window.location.href = "/tests/new")} />
        ) : null}
      </section>

      <AssignModal
        testId={undefined}
        testTitle="Выберите тест в библиотеке"
        classes={dashboard.classes}
        preselectedClassIds={assignClassId ? [assignClassId] : []}
        isOpen={assignOpen}
        onClose={() => {
          setAssignOpen(false);
          setAssignClassId(null);
        }}
      />
    </AppShell>
  );
}
