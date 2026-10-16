# Activity Radar: title, source-health and opportunity semantics — 2026-10-16

## Verified user-facing symptoms

- Settings says 6/6 sources healthy, while the radar page can show 6/8. The radar
  disclosure used stale page-load text; the health diagnostic fetches current data.
- Archive count and per-run retire count can also be stale (39/1 locally versus
  45/3 in the current official catalog). Favor official activity meta metrics.
- One THU event was titled *注意事項 rather than its real event name because a
  later `<h1>` heading overwrote the real `<h1>` heading. An official index lists
  the event as 國科會2026年哲學學門專題研究計畫成果發表會.
- Official culture source is healthy but its 149 scraped entries currently yield
  zero qualified recommendations. It is a **coverage** issue, not an outage.
- Undated built-in overseas-plan portals belong in the reference list, not the
  list of currently actionable event registrations.

## Protections

- No user or production JSON catalog is modified by this patch or in its PR.
- Activity source registry, scholarships, goals, logs, calendar and PWA untouched.
- When the PR is merged, the next official AutoFetch can safely refresh the THU
  title by its stable ID, and old malformed phone cache is hidden meanwhile.
- Disabled Changhua/Nantou and NTU/NCCU source decisions remain unchanged.
- Do not imply the culture feed has relevant nationwide opportunities when it
  reports zero. Expand independently verified nationwide competition/online sources
  separately; do not forge event records.
