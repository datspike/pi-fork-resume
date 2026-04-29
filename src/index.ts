import {
  SessionManager,
  SessionSelectorComponent,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type SessionInfo,
} from "@mariozechner/pi-coding-agent";
import { buildSessionOptionMap } from "./session-label.js";
import { runForkResume } from "./fork-resume.js";

/** Регистрирует команды выбора исходной сессии и создания fork. */
export default function forkResumeExtension(pi: ExtensionAPI): void {
  pi.registerCommand("fork-resume", {
    description: "Fork a session selected from the resume-style picker without opening the source session",
    handler: async (_args, ctx) => executeForkResume(ctx),
  });

  pi.registerCommand("fork-picker", {
    description: "Alias for /fork-resume",
    handler: async (_args, ctx) => executeForkResume(ctx),
  });
}

/** Выполняет fork-resume с безопасным post-switch кодом только на новом контексте. */
async function executeForkResume(ctx: ExtensionCommandContext): Promise<void> {
  await runForkResume({
    waitForIdle: () => ctx.waitForIdle(),
    pickSession: () => pickSession(ctx),
    forkFrom: (sourcePath) => SessionManager.forkFrom(sourcePath, ctx.cwd, ctx.sessionManager.getSessionDir()),
    switchSession: (sessionPath) => ctx.switchSession(sessionPath, {
      withSession: async (nextCtx) => {
        nextCtx.ui.notify("Forked selected session", "info");
      },
    }),
    notify: (message, level) => ctx.ui.notify(message, level),
  });
}

/** Показывает встроенный session picker, а в non-TUI режиме использует простой select. */
async function pickSession(ctx: ExtensionCommandContext): Promise<string | undefined> {
  if (!ctx.hasUI) {
    return pickSessionWithSimpleSelect(ctx);
  }

  return pickSessionWithBuiltInPicker(ctx);
}

/** Использует тот же компонент выбора сессий, что и встроенный /resume. */
async function pickSessionWithBuiltInPicker(ctx: ExtensionCommandContext): Promise<string | undefined> {
  const currentSessionFile = ctx.sessionManager.getSessionFile();

  return ctx.ui.custom<string | undefined>((tui, _theme, keybindings, done) => {
    const selector = new SessionSelectorComponent(
      async (onProgress) => filterSelectableSessions(
        await SessionManager.list(ctx.cwd, ctx.sessionManager.getSessionDir(), onProgress),
        currentSessionFile,
      ),
      async (onProgress) => filterSelectableSessions(await SessionManager.listAll(onProgress), currentSessionFile),
      (sessionPath) => done(sessionPath),
      () => done(undefined),
      () => done(undefined),
      () => tui.requestRender(),
      {
        renameSession: async (sessionFilePath: string, nextName: string | undefined) => {
          const next = (nextName ?? "").trim();
          if (!next) {
            return;
          }
          const session = SessionManager.open(sessionFilePath);
          session.appendSessionInfo(next);
        },
        showRenameHint: true,
        keybindings,
      },
      currentSessionFile,
    );

    return selector;
  });
}

/** Запасной вариант для режимов без полного TUI picker. */
async function pickSessionWithSimpleSelect(ctx: ExtensionCommandContext): Promise<string | undefined> {
  const currentSessions = await SessionManager.list(ctx.cwd, ctx.sessionManager.getSessionDir());
  const currentPath = ctx.sessionManager.getSessionFile();
  const selectable = filterSelectableSessions(currentSessions, currentPath);

  if (selectable.length === 0) {
    ctx.ui.notify("No sessions available to fork", "warning");
    return undefined;
  }

  const optionMap = buildSessionOptionMap(selectable, false);
  const selected = await ctx.ui.select("Fork which session?", [...optionMap.keys()]);
  return selected ? optionMap.get(selected) : undefined;
}

/** Исключает активную сессию из списка выбора, чтобы /fork-resume не дублировал /clone. */
export function filterSelectableSessions(sessions: SessionInfo[], currentSessionFile?: string): SessionInfo[] {
  return sessions.filter((session) => session.path !== currentSessionFile);
}
