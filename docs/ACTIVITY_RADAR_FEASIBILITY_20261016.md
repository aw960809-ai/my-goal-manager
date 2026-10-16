# Goal Manager Activity Radar — participation feasibility preference

Last revised: 2026-10-16. Only active AutoFetch recommendations are affected.

- Stop fetching county government sources for Changhua and Nantou. Keep their
  source IDs registered (disabled) for audit and optional future reactivation.
- Stop dedicated NTU/NCCU in-person law lecture scrapers; avoid spending network
  time on lectures the user ordinarily cannot attend.
- Exclude automatically imported, location-verified **in-person** events in
  Changhua and Nantou, even if published in a national feed. Nationwide online
  opportunities can remain available.
- Preserve campus/Taichung programs and nationwide online competitions,
  professional-language opportunities, law-related events, and other current
  sources. Do NOT exclude all other events from Taipei or all universities.
- Keep the total 12-source registry for provenance; active source count drops
  from 10 to 6. Never rewrite goal history, TOEIC, scholarships or manual
  events. Auto source rows that are no longer recommended are archived with a
  dedicated reason on the next official refresh; local cached rows are hidden
  by a pure display-time filter.
- Source outages must not cause unrelated official rows to be lost. A user
  preference is distinct from source failure and is explicitly auditable.

Verification: run `python -m unittest discover -s tests/autofetch -p 'test_*.py'`,
`bash scripts/verify.sh` and the production AutoFetch/Pages workflow after PR
merge. Do not treat local tests as successful live ingestion.
