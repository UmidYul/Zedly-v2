import { useMemo } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import { loadRecentTests } from "../lib/test-session-storage";

export function MyResultsPage() {
  const completed = useMemo(() => loadRecentTests().filter((item) => item.status === "completed"), []);

  return (
    <AppShell>
      <section className="content-stack">
        <Card>
          <Card.Header>
            <h2>История результатов</h2>
          </Card.Header>
          <Card.Body>
            {completed.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Тест</th>
                      <th>Предмет</th>
                      <th>Дедлайн</th>
                      <th>Прогресс на момент завершения</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completed.map((item) => (
                      <tr key={item.id}>
                        <td>{item.title}</td>
                        <td>{item.subject}</td>
                        <td>{new Date(item.deadline).toLocaleString()}</td>
                        <td>
                          <ProgressBar value={item.progress_answered} labeled />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Завершённых тестов пока нет" description="После завершения результаты появятся здесь." />
            )}
          </Card.Body>
        </Card>
      </section>
    </AppShell>
  );
}
