import type { SchoolUsersQuery } from "./api";

export const queryKeys = {
  me: ["me"] as const,
  teacherDashboard: ["teacher", "dashboard"] as const,
  auth: {
    me: ["auth", "me"] as const,
    loginMethods: ["auth", "login-methods"] as const
  },
  users: {
    all: ["users"] as const,
    school: (schoolId: string, filters: SchoolUsersQuery) => ["users", "school", schoolId, filters] as const
  },
  tests: {
    all: ["tests"] as const,
    detail: (testId: string) => ["tests", "detail", testId] as const,
    classResults: (testId: string, classId: string) => ["tests", "class-results", testId, classId] as const,
    results: (testId: string, classId: string) => ["tests", testId, "results", classId] as const
  },
  analytics: {
    teacherDashboard: (params: { period?: string; class_id?: string }) => ["analytics", "teacher-dashboard", params] as const
  }
};
