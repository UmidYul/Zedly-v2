import { expect, test } from "@playwright/test";

async function login(page, loginValue: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Логин").fill(loginValue);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("teacher web auth flow and class invite generation", async ({ page }) => {
  await login(page, "teacher.a.schoola.1", "teacher-pass");

  await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();

  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Профиль" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Class Invites" }).click();
  await expect(page).toHaveURL(/\/class-invites$/);

  await page.getByRole("button", { name: "Сгенерировать invite" }).click();
  await expect(page.getByRole("heading", { name: "Invite создан" })).toBeVisible();
  await expect(page.locator(".kv-grid dd strong")).toHaveText(/^[A-Z0-9]{6}$/);
});

test("director can filter school users by teacher role", async ({ page }) => {
  await login(page, "director.a.schoola.1", "director-pass");

  await page.getByRole("link", { name: "School Users" }).click();
  await expect(page).toHaveURL(/\/school-users$/);

  await page.getByLabel("Роль").selectOption("teacher");
  await page.getByRole("button", { name: "Применить фильтры" }).click();

  await expect(page.locator("tbody")).toContainText("teacher");
  await expect(page.locator(".metrics-row")).toContainText("Filtered:");
});

test("cookie lifecycle: login refresh succeeds, logout revokes refresh cookie flow", async ({ page }) => {
  await login(page, "teacher.a.schoola.1", "teacher-pass");

  const refreshOk = await page.request.post("/api/v1/auth/refresh", {
    data: {}
  });
  expect(refreshOk.status()).toBe(200);
  const refreshOkBody = await refreshOk.json();
  expect(refreshOkBody.ok).toBe(true);
  expect(typeof refreshOkBody.data?.access_token).toBe("string");

  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);

  const refreshAfterLogout = await page.request.post("/api/v1/auth/refresh", {
    data: {}
  });
  expect(refreshAfterLogout.status()).toBe(401);
  const refreshAfterLogoutBody = await refreshAfterLogout.json();
  expect(refreshAfterLogoutBody.ok).toBe(false);
});

test("logout-all revokes current access token and refresh flow", async ({ page }) => {
  await login(page, "teacher.a.schoola.1", "teacher-pass");

  const refreshBeforeLogoutAll = await page.request.post("/api/v1/auth/refresh", {
    data: {}
  });
  expect(refreshBeforeLogoutAll.status()).toBe(200);
  const refreshBeforeLogoutAllBody = await refreshBeforeLogoutAll.json();
  const accessToken = String(refreshBeforeLogoutAllBody.data?.access_token || "");
  expect(accessToken.length).toBeGreaterThan(10);

  const meBefore = await page.request.get("/api/v1/users/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  expect(meBefore.status()).toBe(200);

  await page.getByRole("button", { name: "Logout All", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);

  const meAfter = await page.request.get("/api/v1/users/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  expect(meAfter.status()).toBe(401);

  const refreshAfter = await page.request.post("/api/v1/auth/refresh", {
    data: {}
  });
  expect(refreshAfter.status()).toBe(401);
});

test("first login enforces OTP password change before dashboard access", async ({ page }) => {
  const directorLogin = await page.request.post("/api/v1/auth/login", {
    data: { login: "director.a.schoola.1", password: "director-pass" }
  });
  expect(directorLogin.status()).toBe(200);
  const directorLoginBody = await directorLogin.json();
  const directorToken = String(directorLoginBody.data?.access_token || "");
  expect(directorToken.length).toBeGreaterThan(10);

  const provision = await page.request.post("/api/v1/users/provision", {
    headers: {
      Authorization: `Bearer ${directorToken}`
    },
    data: {
      role: "student",
      full_name: `E2E Student ${Date.now()}`,
      class_id: "cls_A_7A"
    }
  });
  expect(provision.status()).toBe(201);
  const provisionBody = await provision.json();
  const generatedLogin = String(provisionBody.data?.login || "");
  const generatedOtp = String(provisionBody.data?.otp_password || "");
  expect(generatedLogin.length).toBeGreaterThan(8);
  expect(generatedOtp.length).toBeGreaterThan(7);

  await page.goto("/login");
  await page.getByLabel("Логин").fill(generatedLogin);
  await page.getByLabel("Пароль").fill(generatedOtp);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/first-password/);
  await expect(page.getByRole("heading", { name: "Придумайте свой пароль" })).toBeVisible();

  await page.getByLabel("Новый пароль").fill("student-pass-1");
  await page.getByLabel("Повторите пароль").fill("student-pass-1");
  await page.getByRole("button", { name: "Сохранить и продолжить" }).click();
  await expect(page.getByRole("heading", { name: "Быстрый вход" })).toBeVisible();
  await page.getByRole("button", { name: "Пропустить — сделаю позже" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("tests workbench: teacher create+assign, student finish and see topic breakdown", async ({ page }) => {
  await login(page, "teacher.a.schoola.1", "teacher-pass");

  await page.getByRole("link", { name: "Tests" }).click();
  await expect(page).toHaveURL(/\/tests-workbench$/);

  await page.getByLabel("Title").fill(`E2E WB ${Date.now()}`);
  await page.getByRole("button", { name: "Create + Assign" }).click();

  const teacherResult = page.getByText(/Создан test_id=.*assignment_id=.*/);
  await expect(teacherResult).toBeVisible();
  const teacherResultText = (await teacherResult.textContent()) || "";
  const match = teacherResultText.match(/test_id=([^,\s]+), assignment_id=([^\s]+)/);
  expect(match).not.toBeNull();
  const testId = String(match?.[1] || "");
  const assignmentId = String(match?.[2] || "");
  expect(testId.length).toBeGreaterThan(8);
  expect(assignmentId.length).toBeGreaterThan(8);

  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);

  await login(page, "student.a.7a.schoola.1", "student-pass");
  await page.getByRole("link", { name: "Tests" }).click();
  await expect(page).toHaveURL(/\/tests-workbench$/);

  await page.getByLabel("Test ID").first().fill(testId);
  await page.getByLabel("Assignment ID").fill(assignmentId);
  await page.getByRole("button", { name: "Start Session" }).click();
  await expect(page.getByRole("heading", { name: "Student Test Screen + Result" })).toBeVisible();

  await page.locator('input[type="radio"][name^="question_"]').first().check();
  await page.getByRole("button", { name: "Finish Session" }).click();

  await expect(page.getByRole("heading", { name: "Result Screen" })).toBeVisible();
  await expect(page.locator("tbody")).toContainText("arithmetic");
});
