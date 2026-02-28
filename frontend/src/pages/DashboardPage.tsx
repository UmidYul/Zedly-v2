import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Stat } from "../components/ui/Stat";
import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../state/auth-context";

function DirectorDashboard() {
  const latestTests = [
    { id: "t1", title: "Алгебра. Тема 3", className: "9A", date: "2026-02-26", participants: 26, avg: 78, status: "completed" },
    { id: "t2", title: "Геометрия", className: "8B", date: "2026-02-25", participants: 24, avg: 71, status: "completed" },
    { id: "t3", title: "Физика. Оптика", className: "10A", date: "2026-02-24", participants: 19, avg: 66, status: "running" }
  ];

  return (
    <section className="content-stack">
      <Card>
        <Card.Body>
          <h2>Профиль</h2>
          <p className="panel-note">Директорский обзор школы и ключевых показателей.</p>
        </Card.Body>
      </Card>
      <section className="panel-grid">
        <Stat label="Всего учеников" value={342} delta={3} />
        <Stat label="Активных учителей" value={27} delta={5} />
        <Stat label="Тестов проведено" value={81} delta={8} />
        <Stat label="Средний балл" value="74%" delta={-1} />
      </section>

      <section className="panel-grid">
        <Card>
          <Card.Header>
            <h2>Активность по дням</h2>
          </Card.Header>
          <Card.Body>
            <EmptyState
              title="График подключается на следующем шаге"
              description="Каркас готов, для данных будет подключён endpoint аналитики."
            />
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2>Топ классов</h2>
          </Card.Header>
          <Card.Body className="content-stack">
            <div>
              <strong>9A</strong>
              <ProgressBar value={84} labeled />
            </div>
            <div>
              <strong>8B</strong>
              <ProgressBar value={78} labeled />
            </div>
            <div>
              <strong>10A</strong>
              <ProgressBar value={71} labeled />
            </div>
          </Card.Body>
        </Card>
      </section>

      <Card className="table-panel">
        <Card.Header>
          <h2>Последние тесты</h2>
        </Card.Header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Класс</th>
                <th>Дата</th>
                <th>Участников</th>
                <th>Avg score</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {latestTests.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.className}</td>
                  <td>{item.date}</td>
                  <td>{item.participants}</td>
                  <td>{item.avg}%</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="content-stack">
        <Alert
          variant="warning"
          title="Есть неактивные пользователи"
          message="6 пользователей не заходили в систему более 7 дней."
        />
        <Alert
          variant="info"
          title="Тесты без результатов"
          message="2 назначения всё ещё без завершённых попыток."
        />
      </section>
    </section>
  );
}

function TeacherDashboard({ teacherClasses }: { teacherClasses: Array<{ class_id: string; class_name: string }> }) {
  return (
    <section className="content-stack">
      <Card>
        <Card.Body>
          <h2>Профиль</h2>
          <p className="panel-note">Панель преподавателя: тесты, классы, результаты.</p>
        </Card.Body>
      </Card>
      <section className="panel-grid">
        <Stat label="Мои тесты" value={18} delta={12} />
        <Stat label="Активных сессий" value={5} delta={-2} />
        <Stat label="Учеников в классах" value={teacherClasses.length * 28 || 0} delta={4} />
        <Stat label="Avg score недели" value="76%" delta={3} />
      </section>

      <Card>
        <Card.Header>
          <h2>Мои классы</h2>
        </Card.Header>
        <Card.Body>
          {teacherClasses.length ? (
            <ul className="simple-list">
              {teacherClasses.map((item) => (
                <li key={item.class_id}>
                  <strong>{item.class_name}</strong>
                  <span>{item.class_id}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Классы не привязаны" description="Обратитесь к директору, чтобы назначить классы." />
          )}
        </Card.Body>
      </Card>

      <Card className="table-panel">
        <Card.Header>
          <h2>Последние результаты тестов</h2>
        </Card.Header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Тест</th>
                <th>Класс</th>
                <th>Дата</th>
                <th>Завершили</th>
                <th>Avg score</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Геометрия. Углы</td>
                <td>8B</td>
                <td>2026-02-26</td>
                <td>22/24</td>
                <td>78%</td>
              </tr>
              <tr>
                <td>Физика. Движение</td>
                <td>9A</td>
                <td>2026-02-25</td>
                <td>24/26</td>
                <td>73%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function StudentDashboard({ fullName }: { fullName: string }) {
  return (
    <section className="content-stack">
      <Card>
        <Card.Body>
          <h2>Добрый день, {fullName}</h2>
          <p className="panel-note">Ниже ваши активные тесты и последние результаты.</p>
        </Card.Body>
      </Card>

      <section className="panel-grid">
        <Card>
          <Card.Header>
            <h2>Алгебра: квадратные уравнения</h2>
          </Card.Header>
          <Card.Body>
            <p className="panel-note">Дедлайн: 2026-03-02</p>
            <ProgressBar value={25} labeled />
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>
            <h2>Биология: генетика</h2>
          </Card.Header>
          <Card.Body>
            <p className="panel-note">Дедлайн: 2026-03-03</p>
            <ProgressBar value={0} labeled />
          </Card.Body>
        </Card>
      </section>

      <Card className="table-panel">
        <Card.Header>
          <h2>Последние результаты</h2>
        </Card.Header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Тест</th>
                <th>Дата</th>
                <th>Score</th>
                <th>Прогресс</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>История. XIX век</td>
                <td>2026-02-22</td>
                <td>88%</td>
                <td>
                  <ProgressBar value={88} />
                </td>
              </tr>
              <tr>
                <td>Физика. Механика</td>
                <td>2026-02-19</td>
                <td>74%</td>
                <td>
                  <ProgressBar value={74} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <section className="panel-grid">
        <Stat label="Пройдено тестов" value={24} />
        <Stat label="Средний балл" value="79%" />
        <Stat label="Лучший результат" value="96%" />
      </section>
    </section>
  );
}

export function DashboardPage() {
  const { session } = useAuth();

  if (!session) {
    return null;
  }

  return (
    <AppShell>
      {session.me.role === "director" ? <DirectorDashboard /> : null}
      {session.me.role === "teacher" ? <TeacherDashboard teacherClasses={session.me.teacher_classes || []} /> : null}
      {session.me.role === "student" ? <StudentDashboard fullName={session.me.full_name} /> : null}
      {!["director", "teacher", "student"].includes(session.me.role) ? (
        <section className="content-stack">
          <Card>
            <Card.Body>
              <EmptyState title="Dashboard пока не настроен для этой роли" description={`Роль: ${session.me.role}`} />
            </Card.Body>
          </Card>
        </section>
      ) : null}
    </AppShell>
  );
}
