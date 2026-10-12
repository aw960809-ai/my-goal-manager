# TOEIC Trainer V0.5.1 — separate PWA, shared origin

- Goal Manager remains at `https://aw960809-ai.github.io/my-goal-manager/`.
- Independent TOEIC Trainer PWA is **planned** for `https://aw960809-ai.github.io/toeic-trainer/`, a distinct GitHub repository.
- Both are the same HTTPS origin, enabling opt-in shared localStorage by design, but have different PWA manifest IDs and nonoverlapping service-worker scopes.
- New consent key `toeic-trainer:v051-link-settings`; prior `v05` consent is NOT implicitly imported.
- The separate repository must be created and successfully deployed **before merging this PR**, otherwise the new link will be broken.
- Original `apps/toeic-trainer/` in this repository remains for read-only backup compatibility; do not enable its old consent mechanism.
- The Goal Manager `save()` now checks the whole persisted envelope against the last known committed state (tasks, logs, calendar events, execution plans and other fields). If another tab changed anything, writes fail closed.
- This is a best-effort localStorage optimistic concurrency guard, NOT an atomic multi-tab lock; avoid parallel editing during rollout, and validate on real Android before enabling sync.
- Existing learning history, goals and schema 6 are unchanged.
- Use same Chrome profile on Android; localhost 8766 historical data require one-time backup import into the new standalone PWA.
- Full expert answer/semantic verification of 640 questions remains outstanding.
