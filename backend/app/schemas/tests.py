from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AnswerOptionIn(BaseModel):
    answer_id: str
    text: str
    is_correct: bool = False
    explanation: str | None = None


class QuestionIn(BaseModel):
    question_id: str
    text: str
    topic: str
    points: int = 1
    answers: list[AnswerOptionIn] = Field(default_factory=list)


class TestCreateFullRequest(BaseModel):
    title: str
    subject: str = "general"
    mode: str = "standard"
    status: str = "draft"
    show_answers: str = "after_deadline"
    shuffle_questions: bool = True
    shuffle_answers: bool = True
    time_limit_minutes: int = 30
    allow_retakes: bool = False
    questions: list[QuestionIn] = Field(default_factory=list)
    school_id: str | None = None


class TestCreateResponse(BaseModel):
    id: str
    title: str
    subject: str
    school_id: str
    teacher_id: str
    mode: str
    status: str
    questions_count: int


class AssignmentIn(BaseModel):
    class_id: str
    deadline: str


class AssignTestRequest(BaseModel):
    assignments: list[AssignmentIn]


class AssignTestResponse(BaseModel):
    test_id: str
    assignments_created: list[dict[str, Any]]


class StartSessionRequest(BaseModel):
    assignment_id: str
    offline_mode: bool = False


class StartSessionResponse(BaseModel):
    session_id: str
    assignment_id: str
    status: str
    expires_at: str
    question_order: list[str]
    answer_shuffles: dict[str, list[str]]
    questions: list[dict[str, Any]] | None = None


class AnswerSubmitItem(BaseModel):
    question_id: str
    answer_id: str | None = None
    answered_at: str
    time_spent_seconds: int | None = None


class SubmitAnswersRequest(BaseModel):
    answers: list[AnswerSubmitItem]


class SubmitAnswersResponse(BaseModel):
    session_id: str
    answers_saved: int
    total_answered: int
    status: str
    per_answer_result: list[dict[str, Any]] | None = None


class FinishSessionRequest(BaseModel):
    final_answers: list[AnswerSubmitItem] = Field(default_factory=list)


class FinishSessionResponse(BaseModel):
    session_id: str
    assignment_id: str
    status: str
    score_percent: float | None
    total_questions: int
    answered_questions: int
    correct_answers: int
    late_submission: bool


class OfflineBundleResponse(BaseModel):
    test_id: str
    mode: str
    expires_at: str
    questions: list[dict[str, Any]]


class SyncSessionResponse(BaseModel):
    session_id: str
    synced_answers: int
    total_answered: int
    late_submission: bool
    status: str
