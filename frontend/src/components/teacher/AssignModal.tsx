import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Checkbox, Input } from "../ui/FormFields";
import { useAuth } from "../../state/auth-context";
import { useToastStore } from "../../state/toast-store";
import { queryKeys } from "../../lib/queryKeys";
import { testsAssign } from "../../lib/api";
import type { TeacherClassInfo } from "../../types/teacher";

interface AssignModalProps {
  testId?: string;
  testTitle: string;
  classes: TeacherClassInfo[];
  preselectedClassIds?: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (assignmentId: string, studentsNotified: number) => void;
}

function dateInputFromIso(iso: string): string {
  const date = new Date(iso);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function AssignModal({
  testId,
  testTitle,
  classes,
  preselectedClassIds = [],
  isOpen,
  onClose,
  onSuccess
}: AssignModalProps) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const pushToast = useToastStore((state) => state.pushToast);

  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(preselectedClassIds);
  const [scheduled, setScheduled] = useState(false);
  const [startAt, setStartAt] = useState(dateInputFromIso(new Date().toISOString()));
  const [deadlineAt, setDeadlineAt] = useState(dateInputFromIso(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()));
  const [attemptLimit, setAttemptLimit] = useState<1 | null>(1);

  useEffect(() => {
    if (isOpen) {
      setSelectedClassIds(preselectedClassIds);
    }
  }, [isOpen, preselectedClassIds]);

  const validationError = useMemo(() => {
    if (selectedClassIds.length === 0) {
      return "Выберите хотя бы один класс";
    }
    if (!testId) {
      return "Сначала выберите тест";
    }
    const deadlineTime = new Date(deadlineAt).getTime();
    if (Number.isNaN(deadlineTime) || deadlineTime <= Date.now()) {
      return "Дедлайн должен быть в будущем";
    }
    if (scheduled) {
      const startTime = new Date(startAt).getTime();
      if (Number.isNaN(startTime) || startTime >= deadlineTime) {
        return "Дата начала должна быть раньше дедлайна";
      }
    }
    return "";
  }, [deadlineAt, scheduled, selectedClassIds.length, startAt, testId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!session) {
        throw new Error("Сессия истекла");
      }

      const response = await testsAssign(session.tokens.access_token, testId || "", {
        class_ids: selectedClassIds,
        start_at: scheduled ? new Date(startAt).toISOString() : null,
        deadline_at: new Date(deadlineAt).toISOString(),
        attempt_limit: attemptLimit,
        shuffle_answers: true,
        shuffle_questions: true,
        request_id: `assign_${testId}_${new Date().getTime()}`
      });
      return response;
    },
    onSuccess: (data) => {
      const assignments = data.assignments_created || [];
      const studentsNotified = selectedClassIds.reduce((sum, classId) => {
        const classItem = classes.find((item) => item.id === classId);
        return sum + (classItem?.studentsCount || 0);
      }, 0);

      pushToast({
        type: "success",
        title: "Назначено",
        message: `Уведомлено ${studentsNotified} учеников`
      });

      void queryClient.invalidateQueries({ queryKey: queryKeys.teacherDashboard });
      if (assignments[0]) {
        onSuccess?.(assignments[0].assignment_id, studentsNotified);
      }
      onClose();
    },
    onError: (error) => {
      pushToast({
        type: "error",
        title: "Ошибка назначения",
        message: error instanceof Error ? error.message : "Не удалось назначить тест"
      });
    }
  });

  function toggleClass(classId: string, checked: boolean) {
    setSelectedClassIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, classId]));
      }
      return prev.filter((item) => item !== classId);
    });
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title="Назначить тест"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={Boolean(validationError)}>
            Назначить →
          </Button>
        </>
      }
    >
      <section className="content-stack">
        <p className="panel-note">"{testTitle}"</p>

        <div className="teacher-assign-class-list">
          {classes.map((item) => (
            <Checkbox
              key={item.id}
              checked={selectedClassIds.includes(item.id)}
              onChange={(event) => toggleClass(item.id, event.target.checked)}
              label={`${item.name} — ${item.studentsCount} учеников`}
            />
          ))}
        </div>

        <fieldset className="teacher-inline-radio">
          <legend>Начало доступа</legend>
          <label>
            <input type="radio" checked={!scheduled} onChange={() => setScheduled(false)} /> Сразу
          </label>
          <label>
            <input type="radio" checked={scheduled} onChange={() => setScheduled(true)} /> Запланировать
          </label>
        </fieldset>

        {scheduled ? <Input label="Дата старта" type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} /> : null}

        <Input label="Дедлайн" type="datetime-local" value={deadlineAt} onChange={(event) => setDeadlineAt(event.target.value)} />

        <fieldset className="teacher-inline-radio">
          <legend>Попытки</legend>
          <label>
            <input type="radio" checked={attemptLimit === 1} onChange={() => setAttemptLimit(1)} /> Одна
          </label>
          <label>
            <input type="radio" checked={attemptLimit === null} onChange={() => setAttemptLimit(null)} /> Без ограничений
          </label>
        </fieldset>

        {selectedClassIds.length > 0 ? (
          <p className="teacher-warning-row">
            <AlertCircle size={14} /> Если тест уже назначен в этот период, появится предупреждение о дубликате.
          </p>
        ) : null}

        {validationError ? <p className="ui-field-error">{validationError}</p> : null}
      </section>
    </Modal>
  );
}
