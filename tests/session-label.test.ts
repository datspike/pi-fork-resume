import assert from "node:assert/strict";
import test from "node:test";
import type { SessionInfo } from "@mariozechner/pi-coding-agent";
import { buildSessionOptionMap, compactWhitespace, formatRelativeTime, formatSessionOption, getSessionTitle } from "../src/session-label.js";
import { filterSelectableSessions } from "../src/index.js";

/** Создание тестовой сессии с предсказуемыми значениями. */
function makeSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    path: "/tmp/session.jsonl",
    id: "018f0000-0000-7000-8000-000000000000",
    cwd: "/work/project",
    created: new Date("2026-04-29T10:00:00.000Z"),
    modified: new Date("2026-04-29T11:00:00.000Z"),
    messageCount: 3,
    firstMessage: "First message",
    allMessagesText: "First message",
    ...overrides,
  };
}

test("getSessionTitle_prefers_explicit_name", () => {
  "Показывает пользовательское имя сессии перед первым сообщением.";

  const title = getSessionTitle(makeSession({ name: "  Named session  ", firstMessage: "Ignored" }));

  assert.equal(title, "Named session");
});

test("compactWhitespace_truncates_long_text", () => {
  "Сжимает пробелы и ограничивает длинные подписи.";

  const text = compactWhitespace("one\n\n two   three four", 13);

  assert.equal(text, "one two thre...");
});

test("formatRelativeTime_uses_short_units", () => {
  "Форматирует недавние даты короткими относительными единицами.";

  const now = new Date("2026-04-29T12:00:00.000Z");

  assert.equal(formatRelativeTime(new Date("2026-04-29T11:59:30.000Z"), now), "just now");
  assert.equal(formatRelativeTime(new Date("2026-04-29T11:45:00.000Z"), now), "15m ago");
  assert.equal(formatRelativeTime(new Date("2026-04-29T09:00:00.000Z"), now), "3h ago");
  assert.equal(formatRelativeTime(new Date("2026-04-27T12:00:00.000Z"), now), "2d ago");
});

test("formatSessionOption_includes_cwd_when_requested", () => {
  "Добавляет cwd только для глобального списка сессий.";

  const session = makeSession();

  const now = new Date("2026-04-29T12:00:00.000Z");

  assert.equal(formatSessionOption(session, false, now), "First message | 3 messages | 1h ago");
  assert.equal(formatSessionOption(session, true, now), "First message | 3 messages | 1h ago | /work/project");
});

test("buildSessionOptionMap_disambiguates_duplicate_labels", () => {
  "Различает одинаковые подписи через короткий идентификатор.";

  const first = makeSession({ path: "/tmp/1.jsonl", id: "018f1111-0000-7000-8000-000000000000" });
  const second = makeSession({ path: "/tmp/2.jsonl", id: "018f2222-0000-7000-8000-000000000000" });
  const now = new Date("2026-04-29T12:00:00.000Z");
  const options = buildSessionOptionMap([first, second], false, now);

  assert.deepEqual([...options.values()], ["/tmp/1.jsonl", "/tmp/2.jsonl"]);
  assert.deepEqual([...options.keys()], [
    "First message | 3 messages | 1h ago",
    "First message | 3 messages | 1h ago [018f2222]",
  ]);
});

test("filterSelectableSessions_excludes_current_session", () => {
  "Убирает активную сессию из вариантов выбора.";

  const sessions = [makeSession({ path: "/tmp/current.jsonl" }), makeSession({ path: "/tmp/other.jsonl" })];

  assert.deepEqual(filterSelectableSessions(sessions, "/tmp/current.jsonl").map((session) => session.path), ["/tmp/other.jsonl"]);
});
