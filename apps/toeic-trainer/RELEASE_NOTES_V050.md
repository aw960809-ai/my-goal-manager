# TOEIC Trainer V0.5.0 — opt-in same-origin automatic Goal Manager learning sync

## Behavior
- Still 640 independently counted written questions, 800 cards, 43 reading passages and 20 grammar units. No listening exercise, no rekeying or replacement of existing items.
- Existing `toeic-trainer-v01:learning-state` (Schema 1), draft and SRS are unchanged. Original URL `127.0.0.1:8766` remains independent and usable.
- Deploy the Trainer under `https://<GitHub Pages host>/my-goal-manager/apps/toeic-trainer/` to share the *origin* with Goal Manager. This does not automatically migrate local `127.0.0.1` storage.
- One-time migration: export a Trainer backup from the localhost edition, then import that Trainer backup in the hosted edition. Verify history before enabling linking. Never import it through Goal Manager's own full-backup restoration tool.
- Settings → Goal Manager automatic linking → Enable. Consent begins a new cutoff time. **Previously saved Sessions are not auto-backfilled**, including those imported from localhost.
- Only new successful submitted sessions with at least 60 seconds and a valid matching Level 4 task can be credited, using floor(seconds/60) per session. The score stays only in Trainer; it is not used to determine Goal Manager progress.
- Goal Manager receives new records on next open/return to tab; where both tabs are open the storage/BroadcastChannel events can trigger receipt. This is client-side and does not run in the cloud when all tabs are closed.
- Existing manual logs on the same day and goal, overlaps, dates outside active phase, unknown/archived targets and duplicate IDs are held/excluded; **never written automatically**.
- Only Goal Manager writes its own DB using the existing `save()`, history guard, integrity envelope and backup rotation. Trainer does not read or overwrite Goal Manager's database.

## Audit limits
- `QUALITY_AUDIT_V05.json` and CSV examine all 640 saved stems/keys/options through reproducible static checks. 224 are *review priority*, 0 are structurally blocked. **0 have been semantically certified by an independent expert**. These flags do not mean the question's key is necessarily wrong.
- Specific measurable anomaly: V0.4.2-authored 25 multi-document Part 7 items have A as the key every time. Existing options and historical keyed answer indices are intentionally unchanged; the distribution should be corrected in a separate versioned question-set release, without rewriting historical questions.
- This is an original ETS-format-inspired practice app, not an official ETS examination or licensed scoring system.

## Safety / deployment
- Review PR against `main` first; do not deploy to production until GitHub CI and Android real-device checks pass. Script prepares a separate branch and leaves original stable Goal Manager source untouched.
- Goal Manager expected baseline: V98.13.5 / Schema 6. Candidate target: V98.13.6 / Schema 6. Existing historical TOEIC logs remain preserved.
