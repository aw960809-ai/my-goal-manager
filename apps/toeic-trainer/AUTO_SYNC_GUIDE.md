# TOEIC Trainer V0.5 × Goal Manager V98.13.6 integration contract

This is NEW dedicated code. The retired News × TOEIC synchronization remains removed.

## Ownership
- Trainer data belongs to `toeic-trainer-v01:learning-state` (Schema 1), with SRS, sessions and stats. It never opens or writes the Goal Manager storage key.
- Consent belongs to `toeic-trainer:v05-link-settings`, first enabled only by the user in the hosted Trainer Settings page.
- Goal Manager alone reads these keys **when both apps are served from the same HTTPS origin**, validates records, and uses `save()`/DataPersistence/HistoryGuard for its own new historical logs. No custom backend, token or account API.
- A short receipt at `goal-manager:toeic-sync-status-v1` holds a summary only, not private goal snapshots.
- Scope: browser profile/device; does not magically sync to other devices or cloud.

## Idempotence
- Stable source `tt-...` session ID becomes `sourceEventId`, log ID `toeic-sync-tt-...`.
- Reject duplicate Session IDs, same source ID already in Goal Manager, inferred cross-date intervals, <60s, >6h, future time, listening and malformed source fields.
- Any same-day manual/unknown-source Goal Manager log for the same Level 4 task pauses automatic import, even if exact minutes differ. Overlapping Session intervals are *both held*.
- Multiple non-overlapping v0.5-linked sessions on one day can be imported separately.
- No partial sync of second fragments: credited minutes `Math.floor(seconds / 60)` per session. Not sum seconds across multiple sessions.
- Version, date, completion, time and Level 1–4 hierarchy must all be valid; the target is resolved through known TOEIC phase IDs, not an arbitrary submitted task ID.
- A failed write does not persist or commit a new event, and in-memory logs are restored. A second tab's more recent logs cause a safe stop, not an overwrite.

## One-time migration from localhost
1. Open your original `http://127.0.0.1:8766/` Chrome profile and download Trainer complete backup in Settings.
2. After the GitHub PR is merged/deployed, open `https://aw960809-ai.github.io/my-goal-manager/apps/toeic-trainer/` in **the same Chrome profile**.
3. Import the Trainer backup using the Trainer's own import button, verify historical Session/SRS counts. Original localhost data remains unchanged.
4. Enable auto-link in the hosted Trainer Settings; this chooses the cutoff for **future submissions only**.
5. Complete a new >=60s reading/grammar/vocab exam; open Goal Manager `https://aw960809-ai.github.io/my-goal-manager/` and review the credited record and progress.
6. Never manually backfill an automatically credited interval. Duplicate/historical/conflicting events stay held for manual review.

## Limitations
- If both sites are closed there is no background push; next Goal Manager visit imports pending valid new sessions.
- If user edits/archives existing TOEIC plan or studies outside its active period the event is held, not guessed into another goal.
- Existing >=60s old sessions are deliberately not automatically backfilled even if their prior data are restored from backup.
- The V0.5 automatic-integration tests use synthetic data; a deployment and Android live-origin smoke test is required before production approval.
