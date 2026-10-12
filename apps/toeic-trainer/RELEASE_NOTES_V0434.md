# V0.4.3.4 — Vocabulary hub navigation repair

- Fix information architecture: 800-entry word lookup and bookmarks are **learning tools**, not Settings tools.
- Vocabulary page uses two direct buttons: formal vocabulary exam and searchable eight-at-a-time word bank/bookmarks.
- Word bank remains unavailable during active vocab examinations; score/explanation only appears after submission.
- Dictionary state is **not** a hidden question pool filter; vocab exams use unchanged full bank and due-first prioritization.
- Settings retains appearance, backup, Goal Manager read-only checker, and quality metadata.
- No bank data, answers, question IDs, learning-state keys, exam/bridge logic or user records are modified.
- Staged installer validates SHA-256 and runs all Node regression tests before touching installed files; browser data untouched.
