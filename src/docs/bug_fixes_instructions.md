# Bug Fix Instructions

1. Update `docs/bug_fixes.md` before writing code. List the Bug ID, scope, touched files, and one of {DONE / IN_PROGRESS / NOT_STARTED}. Leave entries in "Pending / Follow-up" while work is in flight.
2. Coding guidelines
   - Follow the spec mirrored in `specs/.vscode/badugi-bugs.code-snippets` and add root-cause / fix notes there when possible.
   - When introducing or extending shared flags such as `isBusted` or `hasActedThisRound`, make sure init/reset logic stays consistent across BET/DRAW/SHOWDOWN.
   - Any change to `recordActionToLog` / `utils/history_rl` must be documented in this file and in `docs/bug_fixes.md`.
3. Bug-specific notes
   - Bug-02 / Bug-04: keep `hasActedThisRound` and `lastAggressor` in sync. If BET completion conditions change, describe the rule and affected files in `docs/bug_fixes.md`.
   - Bug-05: `games/badugi/utils/badugiEvaluator.js` is the single source of truth. UI/logs must use `{ rankType, ranks, kicker, isBadugi }`; do not resurrect the old `score` field.
   - Bug-06 / Bug-07: attach screenshots or short notes when table/player layout changes, and capture the outcome under `specs/`.
   - Bug-08: whenever you add history fields, update the schema description (field list + format) in this file and `docs/bug_fixes.md`.
4. Handling unfinished work
   - If a fix spans multiple commits, keep the remaining items listed under the corresponding Bug entry with explicit file names.
   - Always double-check `git status` and leave `TODO:` comments in code when you have to pause mid-feature.
   - Every bug fix ends with `git add`, `git commit`, and `git push origin <branch>`. Pushing immediately after the fix is now part of the spec - call it out in `docs/bug_fixes.md` if skipping for any reason.


