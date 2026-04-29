import assert from "node:assert/strict";
import test from "node:test";
import type { SessionManager } from "@mariozechner/pi-coding-agent";
import { runForkResume, type ForkResumeDependencies } from "../src/fork-resume.js";

/** Создание зависимостей workflow с записью вызовов. */
function createDeps(overrides: Partial<ForkResumeDependencies> = {}) {
  const calls: string[] = [];
  const notifications: Array<{ message: string; level: string }> = [];

  const deps: ForkResumeDependencies = {
    waitForIdle: async () => {
      calls.push("waitForIdle");
    },
    pickSession: async () => {
      calls.push("pickSession");
      return "/sessions/source.jsonl";
    },
    forkFrom: (sourcePath) => {
      calls.push(`forkFrom:${sourcePath}`);
      return { getSessionFile: () => "/sessions/fork.jsonl" } as SessionManager;
    },
    switchSession: async (sessionPath) => {
      calls.push(`switchSession:${sessionPath}`);
      return {};
    },
    notify: (message, level) => {
      calls.push(`notify:${level}`);
      notifications.push({ message, level });
    },
    ...overrides,
  };

  return { deps, calls, notifications };
}

test("runForkResume_forks_selected_session_and_switches_to_new_file", async () => {
  "Создает fork выбранной сессии и переключается на новый файл.";

  const { deps, calls, notifications } = createDeps();

  const result = await runForkResume(deps);

  assert.deepEqual(result, {
    status: "forked",
    sourcePath: "/sessions/source.jsonl",
    forkedPath: "/sessions/fork.jsonl",
  });
  assert.deepEqual(calls, [
    "waitForIdle",
    "pickSession",
    "forkFrom:/sessions/source.jsonl",
    "switchSession:/sessions/fork.jsonl",
    "notify:info",
  ]);
  assert.deepEqual(notifications, [{ message: "Forked selected session", level: "info" }]);
});

test("runForkResume_cancels_when_user_does_not_pick_session", async () => {
  "Не создает fork без выбранной исходной сессии.";

  const { deps, calls } = createDeps({
    pickSession: async () => {
      calls.push("pickSession");
      return undefined;
    },
  });

  const result = await runForkResume(deps);

  assert.deepEqual(result, { status: "cancelled", reason: "No source session selected" });
  assert.deepEqual(calls, ["waitForIdle", "pickSession"]);
});

test("runForkResume_reports_fork_errors", async () => {
  "Возвращает ошибку, если SessionManager не смог создать fork.";

  const { deps, calls, notifications } = createDeps({
    forkFrom: (sourcePath) => {
      calls.push(`forkFrom:${sourcePath}`);
      throw new Error("invalid session");
    },
  });

  const result = await runForkResume(deps);

  assert.deepEqual(result, {
    status: "failed",
    sourcePath: "/sessions/source.jsonl",
    reason: "invalid session",
  });
  assert.deepEqual(calls, ["waitForIdle", "pickSession", "forkFrom:/sessions/source.jsonl", "notify:error"]);
  assert.deepEqual(notifications, [{ message: "Failed to fork selected session: invalid session", level: "error" }]);
});

test("runForkResume_reports_cancelled_switch_after_creating_fork", async () => {
  "Сообщает об отмене переключения после успешного создания fork.";

  const { deps, calls, notifications } = createDeps({
    switchSession: async (sessionPath) => {
      calls.push(`switchSession:${sessionPath}`);
      return { cancelled: true };
    },
  });

  const result = await runForkResume(deps);

  assert.deepEqual(result, {
    status: "cancelled",
    sourcePath: "/sessions/source.jsonl",
    forkedPath: "/sessions/fork.jsonl",
    reason: "Switch cancelled",
  });
  assert.deepEqual(calls, [
    "waitForIdle",
    "pickSession",
    "forkFrom:/sessions/source.jsonl",
    "switchSession:/sessions/fork.jsonl",
    "notify:warning",
  ]);
  assert.deepEqual(notifications, [{ message: "Fork created, but switching to it was cancelled", level: "warning" }]);
});
