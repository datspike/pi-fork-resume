import type { SessionManager } from "@mariozechner/pi-coding-agent";

export interface ForkResumeDependencies {
  waitForIdle(): Promise<void>;
  pickSession(): Promise<string | undefined>;
  forkFrom(sourcePath: string): SessionManager;
  switchSession(sessionPath: string): Promise<{ cancelled?: boolean }>;
  notify(message: string, level: "info" | "warning" | "error"): void;
}

export interface ForkResumeResult {
  status: "forked" | "cancelled" | "failed";
  sourcePath?: string;
  forkedPath?: string;
  reason?: string;
}

/** Выполняет fork выбранной сессии без открытия исходного файла как активной сессии. */
export async function runForkResume(deps: ForkResumeDependencies): Promise<ForkResumeResult> {
  await deps.waitForIdle();

  const sourcePath = await deps.pickSession();
  if (!sourcePath) {
    return { status: "cancelled", reason: "No source session selected" };
  }

  let forkedPath: string | undefined;
  try {
    const forkedSession = deps.forkFrom(sourcePath);
    forkedPath = forkedSession.getSessionFile();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    deps.notify(`Failed to fork selected session: ${reason}`, "error");
    return { status: "failed", sourcePath, reason };
  }

  if (!forkedPath) {
    const reason = "Forked session is not persisted";
    deps.notify(reason, "error");
    return { status: "failed", sourcePath, reason };
  }

  const switchResult = await deps.switchSession(forkedPath);
  if (switchResult.cancelled) {
    deps.notify("Fork created, but switching to it was cancelled", "warning");
    return { status: "cancelled", sourcePath, forkedPath, reason: "Switch cancelled" };
  }

  deps.notify("Forked selected session", "info");
  return { status: "forked", sourcePath, forkedPath };
}
