# News x TOEIC GitHub migration v2

- Static PWA created at `apps/toeic/`.
- App remains usable without AppDeploy credits.
- News topic metadata refreshes with GitHub Actions + RSS.
- On-device original TOEIC-style lesson builder replaces AppDeploy lesson generation.
- On-device Parts 1–7 practice generator replaces AppDeploy practice API.
- Part 1 uses generated SVG scenes, so no image-generation API is required.
- Article deconstruction runs locally and keeps sentence audio through browser Speech Synthesis.
- Full 200-question training mock is available locally.
- Existing AppDeploy localStorage keys can be imported with the migration UI.
- TOEIC completion events now use same-origin localStorage Goal Sync; Goal Manager no longer needs the AppDeploy iframe bridge.
- Existing imported session/mistake/mock/review keys are preserved.
