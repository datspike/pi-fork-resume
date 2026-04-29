# @datspike/pi-fork-resume

Pi extension that forks a session selected through the resume-style session picker without opening the source session.

## Why

Pi already has useful primitives:

- `pi --fork <path|id>` safely forks a session, but only at process startup.
- `/resume` has the right global session picker, but opens the selected session as the active file.
- `/fork` forks the current active session from a selected message.

This package fills the gap: choose any existing session from the resume picker, copy it into a new fork for the current project, and switch to that fork.

## Install

```bash
pi install npm:@datspike/pi-fork-resume
```

For local development:

```bash
pi -e /home/spike/hobby/pi-fork-resume
```

## Commands

### `/fork-resume`

1. Waits until the current agent turn is idle.
2. Opens the same session picker component used by `/resume`.
3. Lets you choose a session from the current project or all projects.
4. Creates a new session via `SessionManager.forkFrom(sourcePath, ctx.cwd, ctx.sessionManager.getSessionDir())`.
5. Switches to the newly created fork via `ctx.switchSession(forkedFile)`.

The selected source session is not resumed and is not opened as the active session.

### `/fork-picker`

Alias for `/fork-resume`.

## Current `/fork` limitation

The intended long-term UX is to make `/fork` open the resume-style picker. In Pi `0.70.6`, built-in interactive commands are handled before extension commands, and `/fork` is hardcoded to the current-session message picker. A package-level extension cannot safely override that behavior.

This extension deliberately avoids monkey patching Pi internals. When Pi exposes built-in command override hooks or changes command priority, the implementation can register `/fork` as a thin alias to the same workflow.

## Development

```bash
npm install
npm run check
```

The architecture keeps Pi wiring thin:

- `src/index.ts` registers commands and adapts Pi APIs.
- `src/fork-resume.ts` contains the testable workflow.
- `src/session-label.ts` contains fallback selector formatting helpers.
- `tests/*.test.ts` cover cancellation, fork errors, switch cancellation, and option formatting.

## Release

```bash
npm version patch
npm publish --access public
```

The package is published as a Pi package through the `pi.extensions` manifest in `package.json`.
