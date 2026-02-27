from __future__ import annotations

from datetime import timedelta

from app.core.constants import INVITE_TTL_HOURS
from app.core.security import hash_password
from app.core.types import Role, UserStatus
from app.repositories.models import InviteCode, RefreshRecord, School, SchoolClass, TestResource, User, now_utc


class InMemoryStore:
    def __init__(self) -> None:
        self.schools: dict[str, School] = {
            "school_A": School(id="school_A", name="School A", subscription_plan="freemium"),
            "school_B": School(id="school_B", name="School B", subscription_plan="standard"),
        }

        self.users: dict[str, User] = {}
        self.tests: dict[str, TestResource] = {}
        self.classes: dict[str, SchoolClass] = {}
        self.class_students: dict[str, set[str]] = {}
        self.invite_codes: dict[str, InviteCode] = {}

        self.refresh_tokens: dict[str, RefreshRecord] = {}
        self.refresh_family_index: dict[str, set[str]] = {}
        self.refresh_user_index: dict[str, set[str]] = {}
        self.used_refresh_tokens: set[str] = set()
        self.used_refresh_token_family: dict[str, str] = {}
        self.revoked_families: set[str] = set()
        self.access_jti_blacklist: set[str] = set()

        self.login_attempts_by_identity: dict[str, list[int]] = {}

        self.audit_log: list = []
        self.security_alerts: list = []
        self.cross_school_attempts: dict[str, list[int]] = {}
        self.blocked_ips: dict[str, int] = {}

        self._seed()

    def _seed(self) -> None:
        self.users["usr_teacher_A"] = User(
            id="usr_teacher_A",
            school_id="school_A",
            role=Role.TEACHER,
            full_name="Teacher A",
            email="teachera@school.uz",
            password_hash=hash_password("teacher-pass"),
            telegram_id=1110001,
            status=UserStatus.ACTIVE,
        )
        self.users["usr_director_A"] = User(
            id="usr_director_A",
            school_id="school_A",
            role=Role.DIRECTOR,
            full_name="Director A",
            email="directora@school.uz",
            password_hash=hash_password("director-pass"),
            telegram_id=1110002,
            status=UserStatus.ACTIVE,
        )
        self.users["usr_student_A"] = User(
            id="usr_student_A",
            school_id="school_A",
            role=Role.STUDENT,
            full_name="Student A",
            email="studenta@school.uz",
            password_hash=hash_password("student-pass"),
            telegram_id=1110003,
            status=UserStatus.ACTIVE,
        )
        self.users["usr_teacher_B"] = User(
            id="usr_teacher_B",
            school_id="school_B",
            role=Role.TEACHER,
            full_name="Teacher B",
            email="teacherb@school.uz",
            password_hash=hash_password("teacher-pass"),
            telegram_id=2220001,
            status=UserStatus.ACTIVE,
        )
        self.users["usr_inspector_X"] = User(
            id="usr_inspector_X",
            school_id=None,
            district_id="district_X",
            role=Role.INSPECTOR,
            full_name="Inspector X",
            email="inspector@district.uz",
            password_hash=hash_password("inspector-pass"),
            status=UserStatus.ACTIVE,
        )

        self.classes["cls_A_7A"] = SchoolClass(
            id="cls_A_7A",
            school_id="school_A",
            teacher_id="usr_teacher_A",
            name="7A",
        )
        self.classes["cls_B_8A"] = SchoolClass(
            id="cls_B_8A",
            school_id="school_B",
            teacher_id="usr_teacher_B",
            name="8A",
        )

        self.class_students["cls_A_7A"] = {"usr_student_A"}
        self.class_students["cls_B_8A"] = set()

        code = "ABC123"
        self.invite_codes[code] = InviteCode(
            code=code,
            school_id="school_A",
            class_id="cls_A_7A",
            teacher_id="usr_teacher_A",
            expires_at=now_utc() + timedelta(hours=INVITE_TTL_HOURS),
        )

        self.tests["tst_A_1"] = TestResource(
            id="tst_A_1",
            school_id="school_A",
            teacher_id="usr_teacher_A",
            title="Physics School A",
        )
        self.tests["tst_B_1"] = TestResource(
            id="tst_B_1",
            school_id="school_B",
            teacher_id="usr_teacher_B",
            title="Physics School B",
        )

    def reset(self) -> None:
        self.__init__()


store = InMemoryStore()
