import type { SessionInfo } from "@mariozechner/pi-coding-agent";

const MAX_FIRST_MESSAGE_LENGTH = 96;

/** Возвращает пользовательское имя или сжатый первый текст сессии. */
export function getSessionTitle(session: SessionInfo): string {
  const title = session.name?.trim() || session.firstMessage.trim() || "Untitled session";
  return compactWhitespace(title, MAX_FIRST_MESSAGE_LENGTH);
}

/** Форматирует строку сессии для простого select без встроенного TUI picker. */
export function formatSessionOption(session: SessionInfo, showCwd: boolean, now = new Date()): string {
  const modified = formatRelativeTime(session.modified, now);
  const cwd = showCwd && session.cwd ? ` | ${session.cwd}` : "";
  return `${getSessionTitle(session)} | ${session.messageCount} messages | ${modified}${cwd}`;
}

/** Создает устойчивую карту option -> session path для простого select. */
export function buildSessionOptionMap(sessions: SessionInfo[], showCwd: boolean, now = new Date()): Map<string, string> {
  const counts = new Map<string, number>();
  const labels = new Map<string, string>();

  for (const session of sessions) {
    const base = formatSessionOption(session, showCwd, now);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    const label = count === 0 ? base : `${base} [${session.id.slice(0, 8)}]`;
    labels.set(label, session.path);
  }

  return labels;
}

/** Приводит пробелы к однострочному виду и ограничивает длину. */
export function compactWhitespace(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1))}...`;
}

/** Возвращает короткое относительное время для списка сессий. */
export function formatRelativeTime(date: Date, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }

  return date.toISOString().slice(0, 10);
}
