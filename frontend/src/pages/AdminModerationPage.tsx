import { useMemo, useState } from "react";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/FormFields";
import { Tabs } from "../components/ui/Tabs";

type ModerationTab = "reviews" | "questions" | "other";
type ModerationStatus = "pending" | "approved" | "rejected";

interface ModerationItem {
  id: string;
  tab: ModerationTab;
  userName: string;
  school: string;
  timeAgo: string;
  text: string;
  target: string;
  status: ModerationStatus;
}

const ITEMS: ModerationItem[] = [
  {
    id: "m1",
    tab: "reviews",
    userName: "Sam Student",
    school: "School A",
    timeAgo: "10 мин назад",
    text: "Вопрос 5 содержит двусмысленный вариант ответа.",
    target: "test_001/question_5",
    status: "pending"
  },
  {
    id: "m2",
    tab: "questions",
    userName: "Tom Teacher",
    school: "School B",
    timeAgo: "24 мин назад",
    text: "Проверьте корректность формулировки в блоке геометрии.",
    target: "test_070/question_2",
    status: "pending"
  },
  {
    id: "m3",
    tab: "other",
    userName: "Alice Director",
    school: "School A",
    timeAgo: "1 час назад",
    text: "Отзыв по интерфейсу результатов.",
    target: "session_019",
    status: "approved"
  }
];

export function AdminModerationPage() {
  const [tab, setTab] = useState<ModerationTab>("reviews");
  const [statusFilter, setStatusFilter] = useState<"all" | ModerationStatus>("pending");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [items, setItems] = useState(ITEMS);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (item.tab !== tab) {
          return false;
        }
        if (statusFilter !== "all" && item.status !== statusFilter) {
          return false;
        }
        if (schoolFilter !== "all" && item.school !== schoolFilter) {
          return false;
        }
        if (!search.trim()) {
          return true;
        }
        return item.text.toLowerCase().includes(search.toLowerCase());
      }),
    [items, tab, statusFilter, schoolFilter, search]
  );

  function updateItemsStatus(ids: string[], status: ModerationStatus) {
    setItems((current) => current.map((item) => (ids.includes(item.id) ? { ...item, status } : item)));
    setSelectedIds([]);
  }

  return (
    <AdminLayout title="Модерация" subtitle="Очередь отзывов и правок контента">
      <Card>
        <Card.Body className="content-stack">
          <Tabs
            variant="line"
            activeId={tab}
            onChange={(value) => {
              setTab(value as ModerationTab);
              setSelectedIds([]);
            }}
            items={[
              { id: "reviews", label: "Отзывы" },
              { id: "questions", label: "Вопросы" },
              { id: "other", label: "Другое" }
            ]}
          />
          <section className="filter-form">
            <Select
              label="Статус"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | ModerationStatus)}
              options={[
                { value: "all", label: "all" },
                { value: "pending", label: "pending" },
                { value: "approved", label: "approved" },
                { value: "rejected", label: "rejected" }
              ]}
            />
            <Select
              label="Школа"
              value={schoolFilter}
              onChange={(event) => setSchoolFilter(event.target.value)}
              options={[
                { value: "all", label: "all" },
                { value: "School A", label: "School A" },
                { value: "School B", label: "School B" }
              ]}
            />
            <Input label="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Текст обращения" />
          </section>
          {selectedIds.length ? (
            <div className="row-actions">
              <Badge variant="info">Выбрано: {selectedIds.length}</Badge>
              <Button size="sm" onClick={() => updateItemsStatus(selectedIds, "approved")}>
                Одобрить всё
              </Button>
              <Button size="sm" variant="danger" onClick={() => updateItemsStatus(selectedIds, "rejected")}>
                Отклонить всё
              </Button>
            </div>
          ) : null}
        </Card.Body>
      </Card>

      <section className="content-stack">
        {filtered.map((item) => (
          <Card key={item.id}>
            <Card.Body className="content-stack">
              <div className="moderation-head">
                <label className="ui-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) =>
                      setSelectedIds((current) =>
                        event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)
                      )
                    }
                  />
                  <span />
                </label>
                <strong>{item.userName}</strong>
                <span className="panel-note">{item.school}</span>
                <span className="panel-note">{item.timeAgo}</span>
                <Badge variant={item.status === "pending" ? "warning" : item.status === "approved" ? "success" : "danger"}>
                  {item.status}
                </Badge>
              </div>
              <p>{item.text}</p>
              <p className="panel-note">К чему относится: {item.target}</p>
              <div className="row-actions">
                <Button variant="danger" size="sm" onClick={() => updateItemsStatus([item.id], "rejected")}>
                  Отклонить
                </Button>
                <Button variant="secondary" size="sm" onClick={() => updateItemsStatus([item.id], "pending")}>
                  Вернуть в pending
                </Button>
                <Button size="sm" onClick={() => updateItemsStatus([item.id], "approved")}>
                  Опубликовать
                </Button>
              </div>
            </Card.Body>
          </Card>
        ))}
      </section>
    </AdminLayout>
  );
}
