# TOEIC 640-item V0.5 quality audit — measured findings

- Written items: 640; Part 5: 368, Part 6: 44, Part 7: 228. Cards: 800, passages: 43, grammar topics: 20.
- Mechanical error blockers: 0. Priority for further content/semantic review: **224**. Remaining **416** only passed the *machine* checks. Expert-semantic certifications: **0**.
- Flags include missing cited evidence, short reasoning, near-duplicate candidates and statistically unbalanced keyed-option positions. No flagged item is presumed to have a false answer without verifying the original linguistic context.
- Specific repeatable finding: the 25 `v42-p7-*` multi-document questions have option A as the correct answer in **25/25**, a severe psychometric distribution issue. Do not silently reorder the options or reuse existing question IDs: historical answer choices must remain consistent.
- Question identity and its full source context are unique according to existing structural rules; this is not a human semantic uniqueness certification. The user requirement "no question counted multiple times" remains a strict release policy.
- Machine report with per-item flags: `apps/toeic-trainer/QUALITY_AUDIT_V05.json`; CSV for review: `apps/toeic-trainer/QUALITY_AUDIT_V05.csv`. Never equate 640 indexed records with 640 expert-approved correct explanations.
- V0.5 is a link engineering release, not a reauthored official question bank. All 640 original IDs and exact text/option order remain unchanged.
